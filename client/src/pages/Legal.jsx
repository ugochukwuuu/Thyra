import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { Logo } from '../components/Logo.jsx'

// Copy carried over unchanged from the Claude Design "Thyra Legal" file.
const DOCS = {
  terms: {
    label: 'Terms of Service',
    title: 'Terms of Service',
    effective: '1 September 2026',
    blocks: [
      ['p', "These terms govern your access to and use of Thyra's store platform and related services. By creating an account or using Thyra, you agree to these terms."],
      ['h', '1. What Thyra provides'],
      ['p', 'Thyra gives merchants the tools to list products, manage orders, and run a storefront without building or hosting anything themselves.'],
      ['h', '2. Your account'],
      ['li', "You're responsible for keeping your login credentials secure."],
      ['li', 'You must provide accurate business details during onboarding.'],
      ['li', "You're responsible for the products and content you publish through your store."],
      ['h', '3. Fees and payments'],
      ['p', 'Fees for using Thyra are set out at signup and billed on the cycle you choose. Payment processing is handled by our payment partners under their own terms.'],
      ['h', '4. Ending your account'],
      ['p', 'You can close your account at any time from account settings. We may suspend or close accounts that violate these terms or applicable law.'],
    ],
  },
  privacy: {
    label: 'Privacy Policy',
    title: 'Privacy Policy',
    effective: '1 September 2026',
    blocks: [
      ['p', 'This notice explains what information Thyra collects, why, and how it is used to run your store and account.'],
      ['h', '1. Information we collect'],
      ['li', 'Account details: business name, email, and password.'],
      ['li', 'Store data: products, orders, and customer information you manage through Thyra.'],
      ['li', 'Usage data: how you interact with the dashboard, for reliability and support.'],
      ['h', '2. How we use it'],
      ['p', 'We use your information to operate your store, process orders, provide support, and improve the product. We do not sell your data.'],
      ['h', '3. Sharing'],
      ['p', 'We share data only with service providers that help run Thyra — such as payment and hosting partners — and only as needed to provide the service.'],
      ['h', '4. Your choices'],
      ['p', 'You can access, correct, or request deletion of your account data at any time by contacting us.'],
    ],
  },
  cookies: {
    label: 'Cookie Notice',
    title: 'Cookie Notice',
    effective: '1 September 2026',
    blocks: [
      ['p', 'Thyra uses a small number of cookies to keep you signed in and to understand how the dashboard is used.'],
      ['h', '1. Essential cookies'],
      ['p', "These keep you logged in and remember your onboarding progress. The product doesn't work correctly without them."],
      ['h', '2. Analytics cookies'],
      ['p', 'These help us see which features are used and where people get stuck, so we can improve the product. You can opt out in account settings.'],
      ['h', '3. Managing cookies'],
      ['p', 'You can control cookies through your browser settings at any time. Blocking essential cookies may affect sign-in.'],
    ],
  },
}

function renderBlocks(blocks) {
  const out = []
  let list = []
  const flush = () => {
    if (list.length) out.push(<ul key={`ul-${out.length}`}>{list}</ul>)
    list = []
  }
  blocks.forEach(([type, text], i) => {
    if (type === 'li') return list.push(<li key={i}>{text}</li>)
    flush()
    out.push(type === 'h' ? <h2 key={i}>{text}</h2> : <p key={i}>{text}</p>)
  })
  flush()
  return out
}

export default function Legal() {
  const { section } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const doc = DOCS[section]
  if (!doc) return <Navigate to="/legal/terms" replace />

  return (
    <div className="auth-page">
      <header className="app-header">
        <Logo />
        <span className="divider" />
        <span className="label">Legal</span>
        <div className="spacer" />
        <Link to={user ? '/' : '/login'} className="link-muted">
          {user ? '← Back to your account' : '← Back to log in'}
        </Link>
      </header>

      <div className="legal-body">
        <aside className="legal-side">
          <div>
            <span className="legal-eyebrow">Documentation</span>
            <nav aria-label="Legal documents">
              {Object.entries(DOCS).map(([key, d]) => (
                <button
                  key={key}
                  type="button"
                  className={`legal-nav-item${key === section ? ' active' : ''}`}
                  aria-current={key === section ? 'page' : undefined}
                  onClick={() => navigate(`/legal/${key}`)}
                >
                  <i />
                  {d.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="foot">Official terms, privacy, and cookie notices for Thyra Technologies.</div>
        </aside>

        <main className="legal-content">
          <article className="legal-doc">
            <h1>{doc.title}</h1>
            <p className="effective">Effective date: {doc.effective}</p>
            {renderBlocks(doc.blocks)}
            <p style={{ marginTop: 40, fontSize: 14, color: 'var(--grey)' }}>
              Questions about this notice? <a href="mailto:legal@thyra.co">legal@thyra.co</a>
            </p>
          </article>
        </main>
      </div>
    </div>
  )
}
