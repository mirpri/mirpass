import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  Space,
  Typography,
  App,
  Divider,
  Input,
  Form,
} from "antd";
import { useAppStore } from "../store/useAppStore";
import type { ErrorResponse } from "../types";
import { ArrowRight, CircleCheck, XCircle } from "lucide-react";
import { AnyAvatar, MyAvatar } from "../components/Avatars";
import { LoadingView } from "../components/LoadingView";
import { config } from "../config";

const { Title, Text, Paragraph } = Typography;

function AuthorizePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();

  const {
    ssoDetails,
    fetchSsoDetails,
    ssoConfirm,
    profile,
    token,
    logout,
    ssoSessionId: storeSessionId,
    setSsoSessionId,
    ssoType: storeSsoType,
    setSsoType,
    ssoUserCode: storeUserCode,
    setSsoUserCode,
  } = useAppStore();

  const urlSessionId = searchParams.get("session_id");
  const urlFrom = searchParams.get("from");
  const urlUserCode = searchParams.get("user_code");

  // Prioritize URL params
  const ssoSessionId = urlSessionId || storeSessionId;
  const [confirming, setConfirming] = useState(false);

  // Sync URL ID to store
  useEffect(() => {
    if (urlSessionId) {
      if (setSsoSessionId && urlSessionId !== storeSessionId)
        setSsoSessionId(urlSessionId);
      if (setSsoType) setSsoType("auth_code");
    }
  }, [urlSessionId, storeSessionId, setSsoSessionId, setSsoType]);

  // Sync Device Code
  useEffect(() => {
    if (urlUserCode) {
      if (setSsoType) setSsoType("device_code");
      if (setSsoUserCode) setSsoUserCode(urlUserCode);
    }
  }, [urlUserCode, setSsoType, setSsoUserCode]);

  // Auth & Session Check
  useEffect(() => {
    // If not authenticated, we must redirect
    if (!token && (ssoSessionId || urlUserCode)) {
      // Not authenticated, redirect to logic with params
      const fromParam = urlFrom ? `&from=${encodeURIComponent(urlFrom)}` : "";
      const qParams = [];
      if (ssoSessionId) qParams.push(`session_id=${ssoSessionId}`);
      if (urlUserCode) qParams.push(`user_code=${urlUserCode}`);

      const qStr =
        qParams.length > 0 ? `?${qParams.join("&")}${fromParam}` : "";
      navigate(`/login${qStr}`, { replace: true });
    }
  }, [token, ssoSessionId, urlUserCode, urlFrom, navigate, ssoDetails]);

  // Fetch Details
  useEffect(() => {
    if (token && (ssoSessionId || urlUserCode)) {
      fetchSsoDetails().catch((error) => {
        console.error("Failed to fetch SSO details", error);
        const err = error as ErrorResponse;
        message.error(err.response?.data?.error || "Failed to fetch SSO details");
        if (setSsoSessionId) setSsoSessionId(null);
      });
    }
  }, []);

  const handleConfirmSSO = async () => {
    if (!ssoDetails || !ssoSessionId) {
      message.error("Missing SSO session details");
      return;
    }
    setConfirming(true);
    if (storeSsoType === "auth_code") {
      window.location.href = `${config.API_URL}/authorize/consent/redirect?sessionId=${ssoSessionId}&approve=true`;
      setConfirming(false);
      return;
    }
    try {
      await ssoConfirm(true);
      message.success(`Logged in to ${ssoDetails?.appName}`);
      if (setSsoSessionId) setSsoSessionId(null);
    } catch (e) {
      message.error("Failed to confirm login");
    } finally {
      setConfirming(false);
    }
  };

  if (!ssoDetails && (ssoSessionId || storeUserCode)) {
    return <LoadingView />;
  }

  if (!ssoDetails) {
    return (
      <Card className="max-w-sm w-full shadow-2xl" title="Connect a Device">
        <Paragraph>Enter the code displayed on your device.</Paragraph>
        <Form
          layout="vertical"
          onFinish={(values) => {
            setSsoUserCode(values.code);
            setSsoType("device_code");
            fetchSsoDetails().catch(() => {
              message.error("Failed to fetch SSO details with provided code");
              setSsoUserCode(null);
            });
          }}
        >
          <Form.Item
            name="code"
            label="Device Code"
            rules={[{ required: true, message: "Please enter the code" }]}
          >
            <Input
              placeholder="ABCD1234"
              size="large"
              className="text-center tracking-widest uppercase font-mono"
              maxLength={8}
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            Continue
          </Button>
        </Form>
      </Card>
    );
  }

  if (ssoDetails.status === "authorized" || ssoDetails.status === "consumed") {
    return (
      <Card className="max-w-sm w-full shadow-2xl">
        <div className="text-center py-8">
          <CircleCheck className="text-green-500 mb-4 mx-auto" size={64} />
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

  if (ssoDetails.status === "pending") {
    return (
      <Card className="max-w-sm w-full shadow-2xl">
        <Space
          orientation="vertical"
          size="large"
          className="w-full text-center"
        >
          <div className="flex flex-col items-center">
            <AnyAvatar
              size={64}
              url={{ url: ssoDetails.logoUrl, text: ssoDetails.appName }}
              className="m-5"
            />
            <Title level={3} className="m-0">
              {ssoDetails.appName}
            </Title>
            <Text type="secondary">wants to access your account</Text>
          </div>

          <Divider className="my-2" />

          <div className="text-left bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
            <Text
              type="secondary"
              className="text-xs uppercase font-bold tracking-wider"
            >
              Signed in as
            </Text>
            <div className="flex items-center gap-3 mt-2">
              <MyAvatar />
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
            <ArrowRight />
            Continue to {ssoDetails.appName}
          </Button>
          <div className="mb-4">
            <Button type="text" onClick={logout}>
              Change Account
            </Button>
            <Divider type="vertical" />
            <Button
              type="text"
              danger
              onClick={handleConfirmSSO}
              loading={confirming}
            >
              Cancel
            </Button>
          </div>
        </Space>
      </Card>
    );
  }

  return (
    <Card className="max-w-sm w-full shadow-2xl">
      <div className="text-center py-8">
        <XCircle className=" text-red-500 mb-4 mx-auto" size={64} />
        <Title level={3}>Error!</Title>
        <Text className="block mb-6">
          There was an error logging in to {ssoDetails.appName}.
          <br />
          Please try again or contact support.
        </Text>
        <Button type="default" onClick={() => window.close()}>
          Close Window
        </Button>
      </div>
    </Card>
  );
}

export default AuthorizePage;
