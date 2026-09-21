import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { Logo } from '../../components/Logo.jsx'
import { REVIEW_STEP, STEPS } from './model.js'
import './onboarding.css'
import AboutBrand from './steps/AboutBrand.jsx'
import BusinessInfo from './steps/BusinessInfo.jsx'
import Contact from './steps/Contact.jsx'
import Home from './steps/Home.jsx'
import Identity from './steps/Identity.jsx'
import Inspiration from './steps/Inspiration.jsx'
import Policies from './steps/Policies.jsx'
import Review from './steps/Review.jsx'
import Shop from './steps/Shop.jsx'
import Social from './steps/Social.jsx'
import { StepIcon } from './ui.jsx'
import { useOnboarding } from './useOnboarding.js'

const SAVE_LABEL = { saving: 'Saving…', saved: 'Progress saved', error: "Couldn't save — retrying" }

export default function Onboarding() {
  const { logout } = useAuth()
  const ob = useOnboarding()
  const [reviewing, setReviewing] = useState(false) // after submission: false = thank-you card, true = read-only answers
  const mainRef = useRef(null)
  const firstRender = useRef(true)

  // Move focus to the new step so keyboard and screen-reader users land at the top of it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
  }, [ob.step])

  if (ob.phase === 'loading') return <div className="splash">Loading your setup…</div>
  if (ob.phase === 'failed') {
    return (
      <div className="splash" style={{ flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0 }}>{ob.loadError}</p>
        <button type="button" className="btn btn-outline" onClick={ob.retryLoad}>
          Try again
        </button>
      </div>
    )
  }

  const submitted = ob.status === 'submitted'
  const { step } = ob

  async function handleLogout() {
    await ob.flushNow()
    logout()
  }

  const stepProps = {
    data: ob.data,
    update: ob.update,
    errors: ob.errors,
    clearError: ob.clearError,
    uploadFiles: ob.uploadFiles,
  }

  let content
  if (submitted && !reviewing) {
    content = (
      <section className="success-card">
        <span className="pill-tag light">Submitted</span>
        <h1>You&apos;re all set.</h1>
        <p>
          We&apos;ve got everything we need to start building. Your Thyra team will email{' '}
          {ob.data.businessInfo.email.trim() || 'your inbox'} within one business day.
        </p>
        <div className="success-actions">
          <button type="button" className="btn btn-outline-light" onClick={() => setReviewing(true)}>
            Review my answers
          </button>
        </div>
      </section>
    )
  } else if (submitted) {
    content = (
      <>
        <Review data={ob.data} goTo={() => {}} readOnly problemSteps={[]} />
        <div className="ob-nav">
          <button type="button" className="btn btn-outline" onClick={() => setReviewing(false)}>
            Back
          </button>
        </div>
      </>
    )
  } else {
    content = (
      <>
        {step === 0 && <BusinessInfo {...stepProps} />}
        {step === 1 && <Shop {...stepProps} />}
        {step === 2 && <Home {...stepProps} />}
        {step === 3 && <AboutBrand {...stepProps} />}
        {step === 4 && <Contact {...stepProps} />}
        {step === 5 && <Inspiration {...stepProps} />}
        {step === 6 && <Identity {...stepProps} />}
        {step === 7 && <Social {...stepProps} />}
        {step === 8 && <Policies {...stepProps} />}
        {step === REVIEW_STEP && <Review data={ob.data} goTo={ob.goTo} readOnly={false} problemSteps={ob.problemSteps} />}

        {ob.submitError && (
          <p className="error-text" role="alert" style={{ marginTop: 16, textAlign: 'right' }}>
            {ob.submitError}
          </p>
        )}
        <div className="ob-nav">
          {step > 0 && (
            <button type="button" className="btn btn-outline" onClick={ob.back}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step === REVIEW_STEP ? (
            <button type="button" className="btn btn-primary" onClick={ob.confirm} disabled={ob.submitting}>
              {ob.submitting ? 'Confirming…' : 'Confirm details'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={ob.next}>
              Save and continue
            </button>
          )}
        </div>
      </>
    )
  }

  const showRail = !submitted

  return (
    <div className="ob">
      <header className="app-header">
        <Logo />
        <span className="divider" />
        <span className="label">Store onboarding</span>
        <div className="spacer" />
        {!submitted && ob.saveState !== 'idle' && (
          <span className={`save-pill ${ob.saveState}`} role="status" aria-live="polite">
            <i />
            {SAVE_LABEL[ob.saveState]}
          </span>
        )}
        <button type="button" className="link-muted" onClick={handleLogout}>
          Log out
        </button>
      </header>

      {ob.resumed && !submitted && (
        <div className="resume-banner">
          <i />
          <span>Welcome back — everything you entered is still here. Carry on where you left off.</span>
          <button type="button" className="link-btn" onClick={ob.dismissResume}>
            Dismiss
          </button>
        </div>
      )}

      <div className="ob-shell">
        {showRail && (
          <nav className="ob-rail" aria-label="Onboarding steps">
            <div className="rail-title">Your store setup</div>
            {STEPS.map((s, i) => {
              const locked = i > ob.maxReached
              const cls = ['rail-item', i === step && 'current', i < step && 'done', locked && 'locked'].filter(Boolean).join(' ')
              return (
                <button key={s.key} type="button" className={cls} disabled={locked} aria-current={i === step ? 'step' : undefined} onClick={() => ob.goTo(i)}>
                  <span className="rail-icon">
                    <StepIcon name={s.key} />
                  </span>
                  <span className="rail-label">{s.label}</span>
                  <span className="rail-num">{String(i + 1).padStart(2, '0')}</span>
                </button>
              )
            })}
            <div className="rail-note">We save as you type. Log in any time to pick up where you left off.</div>
          </nav>
        )}

        <main className="ob-main" ref={mainRef} tabIndex={-1}>
          {showRail && (
            <div className="ob-mobile-progress">
              <div className="row">
                <span className="count">{step === REVIEW_STEP ? 'Final review' : `Step ${step + 1} of ${REVIEW_STEP}`}</span>
                <span className="current">{STEPS[step].label}</span>
              </div>
              <div className="bar">
                <div style={{ width: `${Math.round(((step + 1) / STEPS.length) * 100)}%` }} />
              </div>
            </div>
          )}
          {content}
        </main>
      </div>
    </div>
  )
}
