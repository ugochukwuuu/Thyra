import { Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireRole, RootRedirect } from './components/RouteGuards.jsx'
import AdminHome from './pages/AdminHome.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Legal from './pages/Legal.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import Onboarding from './pages/onboarding/Onboarding.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import SignUp from './pages/SignUp.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      {/* Reachable while signed in too: the link comes from an email. */}
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<RequireRole role="client" />}>
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin" element={<AdminHome />} />
      </Route>

      <Route path="/legal" element={<Legal />} />
      <Route path="/legal/:section" element={<Legal />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
