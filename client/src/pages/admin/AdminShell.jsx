import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { LogoMark } from '../../components/Logo.jsx'
import './admin.css'
import { initials } from './format.js'
import { ToastProvider } from './ui.jsx'

const NAV = [
  {
    to: '/admin/leads',
    label: 'Leads',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
        <path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
      </>
    ),
  },
  {
    to: '/admin/submissions',
    label: 'Submissions',
    icon: (
      <>
        <path d="M4 13h4l1.5 2.5h5L16 13h4" />
        <path d="M5.5 5h13L20 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V13z" />
      </>
    ),
  },
  {
    to: '/admin/settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
  },
]

function Brand() {
  return (
    <div className="adm-brand">
      <LogoMark />
      <span>Thyra</span>
      <span className="tag">Admin</span>
    </div>
  )
}

function Nav({ onNavigate }) {
  return (
    <nav className="adm-nav" aria-label="Admin">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} onClick={onNavigate} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {n.icon}
          </svg>
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function Me() {
  const { user, logout } = useAuth()
  return (
    <div className="adm-me">
      <span className="adm-avatar" aria-hidden="true">
        {initials(user.fullName, user.email)}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="name clip">{user.fullName || user.email}</div>
        <button type="button" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  )
}

/** Sidebar on desktop, top bar and full-screen menu on phones. Wraps every signed-in admin page. */
export default function AdminShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close the phone menu whenever the page changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <ToastProvider>
      <div className="adm">
        <aside className="adm-side">
          <Brand />
          <Nav />
          <Me />
        </aside>

        <div className="adm-topbar">
          <Brand />
          <div style={{ flex: 1 }} />
          <button type="button" className="icon-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="adm-menu" role="dialog" aria-label="Menu">
            <div style={{ display: 'flex', alignItems: 'center', minHeight: 60 }}>
              <Brand />
              <div style={{ flex: 1 }} />
              <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                ×
              </button>
            </div>
            <Nav onNavigate={() => setMenuOpen(false)} />
            <div style={{ flex: 1 }} />
            <div style={{ paddingRight: 12 }}>
              <Me />
            </div>
          </div>
        )}

        <main className="adm-main">
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  )
}
