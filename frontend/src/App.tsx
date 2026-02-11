import { useState, useEffect, Suspense, lazy } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ConfigProvider, App as AntdApp, theme, message } from "antd";
import { LoadingView } from "./components/LoadingView";

const LoginPage = lazy(() => import("./pages/Login"));
const AuthorizePage = lazy(() => import("./pages/Authorize"));
const ForgetPage = lazy(() => import("./pages/Forget"));
const RegisterPage = lazy(() => import("./pages/Register"));
const VerifyPage = lazy(() => import("./pages/Verify"));
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const AdminPage = lazy(() => import("./pages/Admin"));
const CreateAppPage = lazy(() => import("./pages/CreateApp"));
const ManageAppPage = lazy(() => import("./pages/ManageApp"));
const AboutPage = lazy(() => import("./pages/About"));

import Nav from "./components/Nav";
import { useAppStore } from "./store/useAppStore";

function App() {
  const navigate = useNavigate();
  const { fetchProfile, ssoSessionId, token, setToken, logout } = useAppStore();

  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    // Only redirect to dashboard if NOT in an SSO flow
    if (!ssoSessionId) {
      navigate("/dashboard", { replace: true });
    }
  };

  const isAuthed = Boolean(token);

  useEffect(() => {
    if (isAuthed) {
      fetchProfile().catch((error) => {
        if (error?.response?.status === 401) {
          logout();
        } else {
          message.error("Failed to fetch user profile.");
        }
      });
    }
  }, [isAuthed]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#3aaeed",
          borderRadius: 10,
        },
      }}
    >
      <AntdApp>
        <div className="min-h-screen flex flex-col justify-between align-center bg-gray-100 dark:bg-gray-900 dark:text-white">
          <Nav />
          <div className="flex justify-center align-center p-4">
            <Suspense
              fallback={
                <LoadingView />
              }
            >
              <Routes>
                <Route
                  path="/login"
                  element={
                    <LoginPage
                      onLogin={handleLogin}
                      isAuthenticated={isAuthed}
                    />
                  }
                />
                <Route
                  path="/auth"
                  element={
                    <AuthorizePage />
                  }
                />
                <Route
                  path="/register"
                  element={
                    isAuthed ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <RegisterPage />
                    )
                  }
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
                    isAuthed ? <AdminPage /> : <Navigate to="/login" replace />
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
                  element={
                    <Navigate to={isAuthed ? "/dashboard" : "/login"} replace />
                  }
                />
              </Routes>
            </Suspense>
          </div>
          <div className="text-center text-gray-500 p-4">
            &copy; {new Date().getFullYear()} mirpass. All rights reserved.
          </div>
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
