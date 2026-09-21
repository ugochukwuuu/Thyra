import { Link } from 'react-router-dom'

export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <span className="bars">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="box">
        <span />
      </span>
    </span>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Thyra home">
      <LogoMark />
      <span>Thyra</span>
    </Link>
  )
}
