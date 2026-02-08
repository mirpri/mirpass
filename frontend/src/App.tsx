import { useState, useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ConfigProvider, App as AntdApp, theme } from 'antd'
import LoginPage from './pages/Login'
import ForgetPage from './pages/Forget'
import RegisterPage from './pages/Register'
import VerifyPage from './pages/Verify'
import DashboardPage from './pages/Dashboard'
import AdminPage from './pages/Admin'
import CreateAppPage from './pages/CreateApp'
import ManageAppPage from './pages/ManageApp'
import AboutPage from './pages/About'
import Nav from './components/Nav'
import { useAppStore } from './store/useAppStore'

function App() {
  const navigate = useNavigate()
  const { fetchProfile, ssoSessionId, token, setToken, logout } = useAppStore()

  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches)
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const handleLogin = (newToken: string) => {
    setToken(newToken)
    // Only redirect to dashboard if NOT in an SSO flow
    if (!ssoSessionId) {
      navigate('/dashboard', { replace: true })
    }
  }

  const isAuthed = Boolean(token)

  useEffect(() => {
    if (isAuthed) {
      fetchProfile().catch((error) => {
        // If error is 401, handleLogout will be called by consumer or we can do it here
        // Ideally checking specific error type
        if (error?.response?.status === 401) {
          logout()
        }
      })
    }
  }, [isAuthed])

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#7c3aed',
          borderRadius: 10,
        },
      }}
    >
      <AntdApp>

    <div className="min-h-screen flex flex-col justify-between align-center bg-gray-50 dark:bg-gray-900 dark:text-white">
        <Nav />
        <div className="flex justify-center align-center p-4">
        <Routes>
          <Route
            path="/login"
            element={<LoginPage onLogin={handleLogin} isAuthenticated={isAuthed} />}
          />
          <Route
            path="/register"
            element={isAuthed ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
          />
          <Route path="/forget" element={<ForgetPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route
            path="/dashboard"
            element={
              isAuthed ? (
                <DashboardPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/manage"
            element={
              isAuthed ? (
                <AdminPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/apps/create"
            element={
              isAuthed ? (
                <CreateAppPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/manage/:appId"
            element={
              isAuthed ? (
                <ManageAppPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="*"
            element={<Navigate to={isAuthed ? '/dashboard' : '/login'} replace />}
          />
        </Routes>
        </div>
        <div className="text-center text-gray-500 p-4">
          &copy; {new Date().getFullYear()} mirpass. All rights reserved.
        </div>
        </div>
      </AntdApp>
    </ConfigProvider>
  )
}

export default App
