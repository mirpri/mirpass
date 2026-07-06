import { useState, useEffect, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ConfigProvider, App as AntdApp, theme } from "antd";
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
  const { fetchProfile, token, logout } = useAppStore();
  const { message } = AntdApp.useApp();
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
          colorPrimary: isDarkMode ? "#7dcfff" : "#3097d2",
          colorBgBase: isDarkMode ? "#1a1b26" : "#e9edf9",
          colorBgContainer: isDarkMode ? "#24283b" : "#f7f8ff",
          colorTextBase: isDarkMode ? "#c0caf5" : "#3760bf",
          colorBorder: isDarkMode ? "#414868" : "#a8b5d5",
          borderRadius: 2,
          fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace, "PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", "WenQuanYi Micro Hei", sans-serif',
        },
        components: {
          Modal: {
            contentBg: isDarkMode ? "#24283b" : "#f7f8ff",
          },
        },
      }}
    >
      <AntdApp>
        <div
          className="min-h-screen flex flex-col justify-between align-center"
        >
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
