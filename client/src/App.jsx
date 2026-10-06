import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireClient, RequireStaff, RootRedirect } from './components/RouteGuards.jsx'
import { AdminForgotPassword, AdminLogin, AdminResetPassword, JoinTeam } from './pages/admin/AdminAuth.jsx'
import AdminShell from './pages/admin/AdminShell.jsx'
import Leads from './pages/admin/Leads.jsx'
import Settings from './pages/admin/Settings.jsx'
import SubmissionDetail from './pages/admin/SubmissionDetail.jsx'
import Submissions from './pages/admin/Submissions.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Legal from './pages/Legal.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import Onboarding from './pages/onboarding/Onboarding.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import SignUp from './pages/SignUp.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
      </Route>
      {/* Reachable while signed in too: these links come from emails. */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/admin/reset-password" element={<AdminResetPassword />} />
      <Route path="/admin/join" element={<JoinTeam />} />

      <Route element={<RequireClient />}>
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>

      <Route element={<RequireStaff />}>
        <Route element={<AdminShell />}>
          <Route path="/admin" element={<Navigate to="/admin/submissions" replace />} />
          <Route path="/admin/submissions" element={<Submissions />} />
          <Route path="/admin/submissions/:id" element={<SubmissionDetail />} />
          <Route path="/admin/leads" element={<Leads />} />
          <Route path="/admin/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="/legal" element={<Legal />} />
      <Route path="/legal/:section" element={<Legal />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
