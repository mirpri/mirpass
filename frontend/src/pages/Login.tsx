import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  Form,
  Input,
  Space,
  Typography,
  App
} from "antd";
import {
  LockOutlined,
  UserOutlined,
} from "@ant-design/icons";
import api from "../api/client";
import { useAppStore } from "../store/useAppStore";
import { sha256 } from "../utils/crypto";
import type { ErrorResponse } from "../types";
import { useTranslation } from "react-i18next";

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
  isAuthenticated: boolean;
};

function LoginPage({ isAuthenticated }: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    ssoSessionId, setToken
  } = useAppStore();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (ssoSessionId) {
        navigate(`/auth`, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, ssoSessionId, navigate]);

  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      message.success(t('login.email-verified-you-can-log-in-now'));
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
      setToken(token);
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
            {t('login.login')}
          </Title>
          <Text type="secondary">
            {ssoSessionId
              ? t('login.sign-in-to-continue-to-external-app')
              : t('login.login-to-continue-to-your-dashboard')}
          </Text>
        </Space>

        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            label={t('username')}
            name="username"
            rules={[{ required: true, message: t('login.please-enter-your-username') }]}
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
            rules={[{ required: true, message: t('login.please-enter-your-password') }]}
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
              {t('sign-in')}
            </Button>
          </Form.Item>
        </Form>

        <Space orientation="vertical" size={4}>   
        <Text type="secondary">
          {t('login.new-here')} <Link to="/register">{t('login.create-an-account')}</Link>
        </Text>
        <Link to="/forget">{t('login.forgot-password')}</Link>
        </Space>
      </Space>
    </Card>
  );
}

export default LoginPage;
