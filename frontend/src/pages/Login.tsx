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
} from "antd";
import {
  LockOutlined,
  UserOutlined,
} from "@ant-design/icons";
import api from "../api/client";
import { useAppStore } from "../store/useAppStore";
import { sha256 } from "../utils/crypto";
import type { ErrorResponse } from "../types";

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
    setSsoSessionId,
  } = useAppStore();

  const urlSsoId = searchParams.get("sso");
  const urlFrom = searchParams.get("from");

  // Keep store in sync but don't depend on store for local logic too heavily to avoid loops
  useEffect(() => {
    if (urlSsoId) {
      setSsoSessionId(urlSsoId);
    }
  }, [urlSsoId, setSsoSessionId]);

  const ssoSessionId = urlSsoId || storeSsoId;

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (ssoSessionId) {
        const fromParam = urlFrom ? `&from=${encodeURIComponent(urlFrom)}` : "";
        navigate(`/authorize?sso=${ssoSessionId}${fromParam}`, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, ssoSessionId, urlFrom, navigate]);

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
      
      // Manual navigation check after successful login
      if (ssoSessionId) {
         const fromParam = urlFrom ? `&from=${encodeURIComponent(urlFrom)}` : "";
         navigate(`/authorize?sso=${ssoSessionId}${fromParam}`, { replace: true });
      }
      
    } catch (error: unknown) {
      const err = error as ErrorResponse;
      message.error(
        err.response?.data?.error || "Failed to login",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-sm w-full shadow-2xl">
      <Space orientation="vertical" size="large" className="w-full">
        <Space orientation="vertical" size={4}>
          <Title level={3} className="m-0">
            Login
          </Title>
          <Text type="secondary">
            {ssoSessionId
              ? "Sign in to continue to external app"
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
              placeholder="Username"
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

        <Space orientation="vertical" size={4}>   
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
