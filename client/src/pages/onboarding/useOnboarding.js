import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ApiError, api } from '../../lib/api.js'
import {
  CONTACT_STEP,
  REVIEW_STEP,
  VALIDATED_STEPS,
  blankData,
  hydrate,
  pruneBlankRows,
  prunedSections,
  seedContact,
  toPayload,
  validateStep,
} from './model.js'

const SAVE_DELAY_MS = 800
const RETRY_DELAY_MS = 5000

/**
 * Owns the whole onboarding form: loading, editing, step navigation, debounced autosave,
 * and final submission. Every edit is saved to the server a moment after typing stops.
 */
export function useOnboarding() {
  const { user, sessionExpired } = useAuth()

  const [phase, setPhase] = useState('loading') // loading | ready | failed
  const [loadError, setLoadError] = useState('')
  const [data, setData] = useState(blankData)
  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [status, setStatus] = useState('in_progress')
  const [errors, setErrors] = useState({})
  const [problemSteps, setProblemSteps] = useState([])
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [resumed, setResumed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Refs hold the latest values for the save loop, which outlives any single render.
  const dataRef = useRef(data)
  const maxRef = useRef(0)
  const dirty = useRef(new Set())
  const stepDirty = useRef(false)
  const inflight = useRef(null) // promise of the save in progress, if any
  const timer = useRef(null)
  const savedTimer = useRef(null)
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  const load = useCallback(async () => {
    try {
      const { submission } = await api('/onboarding')
      const hydrated = hydrate(submission, user)
      dataRef.current = hydrated
      maxRef.current = submission.currentStep
      setData(hydrated)
      setStep(Math.min(submission.currentStep, REVIEW_STEP))
      setMaxReached(submission.currentStep)
      setStatus(submission.status)
      setResumed(submission.status === 'in_progress' && submission.currentStep > 0)
      setPhase('ready')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return sessionExpired()
      setLoadError(err instanceof ApiError ? err.message : 'Something went wrong.')
      setPhase('failed')
    }
  }, [user, sessionExpired])

  useEffect(() => {
    // Fetching on mount; state is only set after the request resolves.
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  const retryLoad = useCallback(() => {
    setPhase('loading')
    load()
  }, [load])

  /**
   * Sends pending changes. Resolves true once everything is saved, false if it could not be.
   * If a save is already running, waits for it and then sends whatever changed meanwhile,
   * so `await flush()` always means "the server has my latest edits".
   */
  const flush = useCallback(
    async function run(opts = {}) {
      const { keepalive = false } = opts
      clearTimeout(timer.current)
      if (statusRef.current === 'submitted') return true
      if (inflight.current) return inflight.current.then(() => run(opts))
      if (dirty.current.size === 0 && !stepDirty.current) return true

      const sections = [...dirty.current]
      const sendStep = stepDirty.current
      dirty.current = new Set()
      stepDirty.current = false

      const body = Object.fromEntries(sections.map((s) => [s, toPayload(s, dataRef.current)]))
      if (sendStep) body.currentStep = maxRef.current

      clearTimeout(savedTimer.current)
      setSaveState('saving')
      const attempt = api('/onboarding', { method: 'PUT', body, keepalive }).then(
        () => null,
        (err) => err,
      )
      inflight.current = attempt
      const failure = await attempt
      inflight.current = null

      if (failure) {
        if (failure instanceof ApiError && failure.status === 401) {
          sessionExpired()
          return false
        }
        if (failure instanceof ApiError && failure.status === 409) {
          // Already submitted (perhaps in another tab): nothing more to save.
          dirty.current.clear()
          stepDirty.current = false
          setStatus('submitted')
          return true
        }
        // Put the work back so the retry sends it.
        sections.forEach((s) => dirty.current.add(s))
        if (sendStep) stepDirty.current = true
        setSaveState('error')
        timer.current = setTimeout(() => run(), RETRY_DELAY_MS)
        return false
      }

      if (dirty.current.size || stepDirty.current) return run(opts)
      setSaveState('saved')
      savedTimer.current = setTimeout(() => setSaveState('idle'), 1600)
      return true
    },
    [sessionExpired],
  )

  const scheduleSave = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(), SAVE_DELAY_MS)
  }, [flush])

  // Save what's pending if the tab is hidden or closed, and stop timers on unmount.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush({ keepalive: true })
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      clearTimeout(timer.current)
      clearTimeout(savedTimer.current)
      flush({ keepalive: true })
    }
  }, [flush])

  /** Edit one section: `mutate` receives a copy of it to change in place. */
  const update = useCallback(
    (section, mutate) => {
      const draft = structuredClone(dataRef.current[section])
      mutate(draft)
      const next = { ...dataRef.current, [section]: draft }
      dataRef.current = next
      setData(next)
      dirty.current.add(section)
      setResumed(false)
      scheduleSave()
    },
    [scheduleSave],
  )

  const clearError = useCallback((key) => {
    setErrors((e) => {
      if (!(key in e)) return e
      const { [key]: _removed, ...rest } = e
      return rest
    })
  }, [])

  const scrollTop = () => requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))

  const moveTo = useCallback(
    (target) => {
      if (target === CONTACT_STEP && !dataRef.current.contactPage.seeded) {
        dataRef.current = seedContact(dataRef.current)
        setData(dataRef.current)
        dirty.current.add('contactPage')
      }
      if (target > maxRef.current) {
        maxRef.current = target
        setMaxReached(target)
        stepDirty.current = true
      }
      setStep(target)
      setErrors({})
      setProblemSteps([])
      setSubmitError('')
      flush()
      scrollTop()
    },
    [flush],
  )

  /** Drops blank rows the person added but never filled in, and queues the affected sections for saving. */
  const pruneRows = useCallback(() => {
    const before = dataRef.current
    const pruned = pruneBlankRows(before)
    const changed = prunedSections(before, pruned)
    if (changed.length) {
      dataRef.current = pruned
      setData(pruned)
      changed.forEach((section) => dirty.current.add(section))
    }
  }, [])

  const next = useCallback(() => {
    pruneRows()
    const found = validateStep(step, dataRef.current)
    if (Object.keys(found).length) {
      setErrors(found)
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], .has-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
      return
    }
    moveTo(Math.min(step + 1, REVIEW_STEP))
  }, [step, moveTo, pruneRows])

  const back = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0))
    setErrors({})
    scrollTop()
  }, [])

  const goTo = useCallback(
    (target) => {
      if (target <= maxRef.current) moveTo(target)
    },
    [moveTo],
  )

  const confirm = useCallback(async () => {
    setSubmitError('')
    pruneRows()
    const bad = VALIDATED_STEPS.filter((s) => Object.keys(validateStep(s, dataRef.current)).length)
    if (bad.length) {
      setProblemSteps(bad)
      return
    }
    setProblemSteps([])
    setSubmitting(true)
    try {
      await flush()
      const { submission } = await api('/onboarding/submit', { method: 'POST', body: {} })
      setStatus(submission.status)
      scrollTop()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return sessionExpired()
      if (err instanceof ApiError && err.status === 422) {
        setProblemSteps([...new Set(err.problems.map((p) => p.step))])
      } else {
        setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }, [flush, sessionExpired, pruneRows])

  /** Uploads files of one kind (image | media | document) and returns the stored file records. */
  const uploadFiles = useCallback(
    async (files, kind) => {
      const form = new FormData()
      files.forEach((f) => form.append('files', f))
      try {
        const { files: stored } = await api(`/onboarding/files?kind=${kind}`, { method: 'POST', form })
        return stored
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) sessionExpired()
        throw err
      }
    },
    [sessionExpired],
  )

  const flushNow = useCallback(() => flush(), [flush])

  return {
    phase,
    loadError,
    retryLoad,
    data,
    update,
    step,
    maxReached,
    status,
    errors,
    clearError,
    problemSteps,
    saveState,
    resumed,
    dismissResume: () => setResumed(false),
    submitting,
    submitError,
    next,
    back,
    goTo,
    confirm,
    uploadFiles,
    flushNow,
  }
}
