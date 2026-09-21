import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo.jsx'

export default function NotFound() {
  return (
    <div className="center-page">
      <header className="app-header">
        <Logo />
      </header>
      <div className="center-body">
        <div>
          <span className="pill-tag">404</span>
          <h1>We couldn&apos;t find that page.</h1>
          <p>
            <Link to="/">Go back home</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
