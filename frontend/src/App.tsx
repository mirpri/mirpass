import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import VerifyPage from './pages/Verify'
import DashboardPage from './pages/Dashboard'
import AdminPage from './pages/Admin'
import CreateAppPage from './pages/CreateApp'
import ManageAppPage from './pages/ManageApp'
import Nav from './components/Nav'

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const navigate = useNavigate()

  const handleLogin = (newToken: string) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    navigate('/dashboard', { replace: true })
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    navigate('/login', { replace: true })
  }

  const isAuthed = Boolean(token)

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#7c3aed',
          borderRadius: 10,
        },
      }}
    >
      <AntdApp>

    <div className="min-h-screen bg-gray-50 flex flex-col justify-between align-center">
        <Nav onLogout={handleLogout}/>
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
          <Route path="/verify" element={<VerifyPage />} />
          <Route
            path="/dashboard"
            element={
              isAuthed ? (
                <DashboardPage onLogout={handleLogout} />
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
