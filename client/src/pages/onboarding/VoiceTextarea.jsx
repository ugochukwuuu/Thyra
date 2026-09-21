import { useEffect, useRef, useState } from 'react'
import { Field } from '../../components/Field.jsx'

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined

const UNSUPPORTED =
  "Voice input isn't available in this browser (Safari and iOS don't support it yet). You can type here instead."

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser settings to use voice input.',
  'service-not-allowed': 'Microphone access is blocked. Allow it in your browser settings to use voice input.',
  'no-speech': "We didn't catch anything. Tap the mic and try again.",
  'audio-capture': "We couldn't find a microphone on this device.",
  network: 'Voice input needs an internet connection.',
}

// Only one field listens at a time; starting another stops the previous one.
let stopActive = null

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

/**
 * A textarea with a microphone button. Spoken text is appended as it is recognised and
 * stays fully editable. Uses the browser's built-in SpeechRecognition; nothing leaves
 * the app except through the browser's own speech service.
 */
export function VoiceTextarea({ label, hint, error, value, onChange, placeholder, rows = 5, disabled, hideLabel }) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [message, setMessage] = useState('')
  const recognition = useRef(null)
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])

  useEffect(
    () => () => {
      recognition.current?.abort()
      recognition.current = null
    },
    [],
  )

  const append = (text) => {
    const current = latest.current ?? ''
    const separator = current && !/\s$/.test(current) ? ' ' : ''
    const next = current + separator + text.trim()
    latest.current = next
    onChange(next)
  }

  function start() {
    if (!Recognition) return setMessage(UNSUPPORTED)
    stopActive?.()
    setMessage('')

    const rec = new Recognition()
    rec.lang = navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event) => {
      let heard = ''
      let partial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) heard += result[0].transcript
        else partial += result[0].transcript
      }
      if (heard) append(heard)
      setInterim(partial)
    }
    rec.onerror = (event) => {
      if (event.error !== 'aborted') setMessage(ERROR_MESSAGES[event.error] ?? 'Voice input stopped unexpectedly. Try again.')
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
      if (recognition.current === rec) recognition.current = null
      if (stopActive === stop) stopActive = null
    }

    const stop = () => rec.stop()
    try {
      rec.start()
    } catch {
      return setMessage('Voice input could not start. Try again in a moment.')
    }
    recognition.current = rec
    stopActive = stop
    setListening(true)
  }

  const toggle = () => (listening ? recognition.current?.stop() : start())

  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel}>
      {(aria) => (
        <div className="voice-wrap">
          <textarea
            className="textarea"
            style={{ minHeight: `${rows * 24 + 24}px` }}
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            {...aria}
          />
          {!disabled && (
            <div className="voice-bar">
              <button
                type="button"
                className={`mic${listening ? ' on' : ''}`}
                onClick={toggle}
                aria-pressed={listening}
                aria-label={listening ? `Stop voice input for ${label}` : `Start voice input for ${label}`}
              >
                <MicIcon />
                {listening ? 'Listening… tap to stop' : 'Speak instead'}
              </button>
              {interim && <span className="voice-interim">{interim}</span>}
            </div>
          )}
          {message && (
            <p className="voice-message" role="status">
              {message}
            </p>
          )}
        </div>
      )}
    </Field>
  )
}
