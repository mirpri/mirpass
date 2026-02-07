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
import { LockOutlined, UserOutlined, CheckCircleFilled } from "@ant-design/icons";
import api from "../api/client";

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

  // SSO State
  const ssoSessionId = searchParams.get("sso");
  const [ssoDetails, setSsoDetails] = useState<{
    appName: string;
    sessionId: string;
    status: string;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    // Only redirect if NOT in SSO mode
    if (isAuthenticated && !ssoSessionId) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate, ssoSessionId]);

  useEffect(() => {
    if (ssoSessionId) {
      fetchSsoDetails(ssoSessionId);
    }
  }, [ssoSessionId]);

  const fetchSsoDetails = async (sid: string) => {
    try {
      const { data } = await api.get(`/sso/details?session_id=${sid}`);
      setSsoDetails(data.data);
    } catch (e) {
      message.error("Invalid or expired session");
    }
  };

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
      const { data } = await api.post<LoginResponse>("/login", values);
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
        err.response?.data?.message || "Invalid username or password",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSSO = async () => {
    if (!ssoSessionId) return;
    setConfirming(true);
    try {
      await api.post("/sso/confirm", { sessionId: ssoSessionId });
      message.success("Authorized successfully");

      const fromUrl = searchParams.get("from");
      if (fromUrl) {
        try {
          // Construct URL properly to handle existing params
          const url = new URL(fromUrl);
          url.searchParams.set("mirpass_sso", ssoSessionId);
          window.location.href = url.toString();
          return;
        } catch (e) {
             // Fallback if fromUrl is invalid URL (e.g. relative path, though usually TPA should provide full url)
             // But usually for security it should probably be full URL or we assume absolute.
             // If manual string concatenation:
             const separator = fromUrl.includes("?") ? "&" : "?";
             window.location.href = `${fromUrl}${separator}mirpass_sso=${ssoSessionId}`;
             return;
        }
      }

      setSsoDetails((prev) => (prev ? { ...prev, status: "confirmed" } : prev));
      // Optionally close window?
      // window.close();
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
                <Avatar size={64} className="mb-4 bg-purple-100 text-purple-600">
                    {ssoDetails.appName.charAt(0).toUpperCase()}
                </Avatar>
                <Title level={3} className="m-0">
                    {ssoDetails.appName}
                </Title>
                <Text type="secondary">wants to access your account</Text>
            </div>

            <Divider className="my-2" />

            <div className="text-left bg-gray-50 p-4 rounded-lg border border-gray-100">
                <Text type="secondary" className="text-xs uppercase font-bold tracking-wider">Signed in as</Text>
                <div className="flex items-center gap-3 mt-2">
                     <Avatar style={{ backgroundColor: '#7c3aed' }} icon={<UserOutlined />} />
                     <div className="flex flex-col">
                         {/* TODO We assume we have user context somewhere, simple placeholder for now. 
                             Ideally extract username from token or store.
                         */}
                         <Text strong>Current User</Text> 
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
             <Button 
                type="text" 
                block 
                onClick={() => navigate('/dashboard')}
            >
                Cancel
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
            {ssoSessionId && ssoDetails ? `Login to ${ssoDetails.appName}` : "Login"}
          </Title>
          <Text type="secondary">
              {ssoSessionId ? "Sign in to continue" : "Login to continue to your dashboard"}
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

        <Text type="secondary">
          New here? <Link to="/register">Create an account</Link>
        </Text>
      </Space>
    </Card>
  );
}

export default LoginPage;
