import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  Form,
  Input,
  Space,
  Typography,
  message,
  Avatar,
  Divider,
} from "antd";
import {
  LockOutlined,
  UserOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";
import api from "../api/client";
import { useAppStore } from "../store/useAppStore";
import { sha256 } from "../utils/crypto";

const { Title, Text } = Typography;

type LoginPayload = {
  username: string;
  password: string;
};

type LoginResponse = {
  status: number;
  message?: string;
  data?: {
    token?: string;
  };
};

type Props = {
  onLogin: (token: string) => void;
  isAuthenticated: boolean;
};

function LoginPage({ onLogin, isAuthenticated }: Props) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    ssoSessionId: storeSsoId,
    fromPath,
    setSsoSessionId,
    setFromPath,
    ssoDetails,
    ssoConfirm,
    fetchSsoDetails,
    profile,
    logout,
  } = useAppStore();

  const urlSsoId = searchParams.get("sso");
  const urlFrom = searchParams.get("from");

  useEffect(() => {
    if (urlSsoId) {
      setSsoSessionId(urlSsoId);
    }
    if (urlFrom) {
      setFromPath(urlFrom);
    }
  }, [urlSsoId, urlFrom, setSsoSessionId, setFromPath]);

  // SSO State - prioritise URL but fallback to store (e.g. coming back from Register)
  const ssoSessionId = urlSsoId || storeSsoId;
  const activeFrom = urlFrom || fromPath;

  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    // Only redirect if NOT in SSO mode
    if (isAuthenticated && !ssoSessionId) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate, ssoSessionId]);

  useEffect(() => {
    if (ssoSessionId) {
      setSsoSessionId(ssoSessionId); // ensure store is in sync if we got it from URL

      fetchSsoDetails().then(() => {
        if (ssoDetails?.status === "confirmed") {
          message.success(`Already logged in to ${ssoDetails.appName}`);
          setSsoSessionId(null); // clear SSO session to prevent confusion
        }
      }).catch(() => {
        message.error("Failed to fetch SSO details");
        setSsoSessionId(null);
        navigate("/login", { replace: true });
      });
    }
  }, [ssoSessionId]);

  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      message.success("Email verified. You can log in now.");
      const next = new URLSearchParams(searchParams);
      next.delete("verified");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleFinish = async (values: LoginPayload) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        password: await sha256(values.password),
      };
      const { data } = await api.post<LoginResponse>("/login", payload);
      const token = data?.data?.token;

      if (!token) {
        throw new Error("Missing token from server response");
      }

      message.success(data?.message || "Logged in");
      onLogin(token);
      // Navigation happens automatically via useEffect if not SSO
      // If SSO, we stay here to show consent screen
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(
        err.response?.data?.message || "Failed to login",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSSO = async () => {
    if (!ssoSessionId) return;
    setConfirming(true);
    try {
      await ssoConfirm();
      setSsoSessionId(null); // clear SSO session to prevent confusion
      message.success(`Logged in to ${ssoDetails?.appName}`);
      // Redirect to app or dashboard
      if (activeFrom) {
        setTimeout(() => {
          window.location.href = activeFrom;
        }, 500);
      }
    } catch (e) {
      message.error("Failed to confirm login");
    } finally {
      setConfirming(false);
    }
  };

  if (ssoSessionId && ssoDetails?.status === "confirmed") {
    return (
      <Card className="max-w-sm w-full shadow-2xl">
        <div className="text-center py-8">
          <CheckCircleFilled className="text-6xl text-green-500 mb-4" />
          <Title level={3}>Success!</Title>
          <Text className="block mb-6">
            You have logged in to {ssoDetails.appName}.
            <br />
            You can close this window now.
          </Text>
          <Button type="default" onClick={() => window.close()}>
            Close Window
          </Button>
        </div>
      </Card>
    );
  }

  if (ssoSessionId && isAuthenticated && ssoDetails) {
    return (
      <Card className="max-w-sm w-full shadow-2xl">
        <Space direction="vertical" size="large" className="w-full text-center">
          <div className="flex flex-col items-center">
            <Avatar
              size={64}
              src={ssoDetails.logoUrl}
              style={{margin: "10px"}}
            >
              {ssoDetails.appName.charAt(0).toUpperCase()}
            </Avatar>
            <Title level={3} className="m-0">
              {ssoDetails.appName}
            </Title>
            <Text type="secondary">wants to access your account</Text>
          </div>

          <Divider className="my-2" />

          <div className="text-left bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-lg">
            <Text
              type="secondary"
              className="text-xs uppercase font-bold tracking-wider"
            >
              Signed in as
            </Text>
            <div className="flex items-center gap-3 mt-2">
              <Avatar src={profile?.avatarUrl} icon={<UserOutlined />} />
              <div className="flex flex-col">
                <Text strong>{profile?.nickname}</Text>
                <Text type="secondary">{profile?.username}</Text>
              </div>
            </div>
          </div>

          <Button
            type="primary"
            size="large"
            block
            onClick={handleConfirmSSO}
            loading={confirming}
          >
            Continue to {ssoDetails.appName}
          </Button>
          <Button type="text" block onClick={logout}>
            Change Account
          </Button>
        </Space>
      </Card>
    );
  }

  return (
    <Card className="max-w-sm w-full shadow-2xl">
      <Space direction="vertical" size="large" className="w-full">
        <Space direction="vertical" size={4}>
          <Title level={3} className="m-0">
            {ssoSessionId && ssoDetails
              ? `Login to ${ssoDetails.appName}`
              : "Login"}
          </Title>
          <Text type="secondary">
            {ssoSessionId
              ? "Sign in to continue"
              : "Login to continue to your dashboard"}
          </Text>
        </Space>

        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Please enter your username" }]}
          >
            <Input
              size="large"
              prefix={<UserOutlined />}
              placeholder="johndoe"
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              Sign in
            </Button>
          </Form.Item>
        </Form>

        <Space direction="vertical" size={4}>   
        <Text type="secondary">
          New here? <Link to="/register">Create an account</Link>
        </Text>
        <Link to="/forget">Forgot Password?</Link>
        </Space>
      </Space>
    </Card>
  );
}

export default LoginPage;
