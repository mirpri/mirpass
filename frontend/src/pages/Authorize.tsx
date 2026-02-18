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
import { ArrowRight, CircleCheck, CircleX, XCircle } from "lucide-react";
import { AnyAvatar, MyAvatar } from "../components/Avatars";
import { LoadingView } from "../components/LoadingView";
import api from "../api/client";
import { useTranslation } from "react-i18next";

const { Title, Text, Paragraph } = Typography;

function AuthorizePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();
  const { t } = useTranslation();

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
    setSsoUserCode,
  } = useAppStore();

  const urlSessionId = searchParams.get("session_id");
  const urlUserCode = searchParams.get("user_code");

  // Prioritize URL params
  const ssoSessionId = urlSessionId || storeSessionId;
  const [confirming, setConfirming] = useState(false);
  const [denying, setDenying] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Sync URL ID to store
  useEffect(() => {
    if (urlSessionId) {
      if (setSsoSessionId && urlSessionId !== storeSessionId)
        setSsoSessionId(urlSessionId);
      if (setSsoType) setSsoType("auth_code");
    }
    if (!token && storeSessionId) {
      navigate(`/login`, { replace: true });
    }
  }, [urlSessionId, storeSessionId, setSsoSessionId, setSsoType]);

  // Sync Device Code
  useEffect(() => {
    if (urlUserCode) {
      if (setSsoType) setSsoType("device_code");
      if (setSsoUserCode) setSsoUserCode(urlUserCode);
    }
  }, [urlUserCode, setSsoType, setSsoUserCode]);

  // Fetch Details
  useEffect(() => {
    if (token && (ssoSessionId || urlUserCode)) {
      setFetchingDetails(true);
      fetchSsoDetails()
        .catch((error) => {
          console.error("Failed to fetch SSO details", error);
          const err = error as ErrorResponse;
          message.error(
            err.response?.data?.error || "Failed to fetch SSO details",
          );
          if (setSsoSessionId) setSsoSessionId(null);
        })
        .finally(() => {
          setFetchingDetails(false);
        });
    }
  }, []);

  const handleConfirmSSO = async (approve: boolean) => {
    if (!ssoDetails || !ssoSessionId) {
      message.error("Missing SSO session details");
      return;
    }
    if (approve) {
      setConfirming(true);
    } else {
      setDenying(true);
    }
    if (storeSsoType === "auth_code") {
      try {
        const { data } = await api.post("/authorize/consent/redirect", {
          sessionId: ssoSessionId,
          approve: approve,
        });

        if (data?.data?.redirectUrl) {
          window.location.href = data.data.redirectUrl;
        } else {
          message.error("Invalid response from server");
        }
      } catch (e) {
        message.error("Failed to authorize request");
      } finally {
        setConfirming(false);
        setDenying(false);
      }
      return;
    }
    try {
      await ssoConfirm(approve);
      if (approve) message.success("Logged in to " + ssoDetails?.appName);
      else message.info("Login cancelled");
      if (setSsoSessionId) setSsoSessionId(null);
    } catch (e) {
      message.error("Failed to confirm login");
    } finally {
      setConfirming(false);
      setDenying(false);
    }
  };

  const handleChangeAccount = () => {
    logout();
    navigate("/login", { replace: true });
  };

  if (!ssoDetails && fetchingDetails) {
    return <LoadingView />;
  }

  if (!ssoDetails) {
    return (
      <Card className="max-w-sm w-full shadow-2xl" title={t('auth.connect-a-device')}>
        <Paragraph>{t('auth.enter-the-code-displayed-on-your-device')}</Paragraph>
        <Form
          layout="vertical"
          onFinish={(values) => {
            setSsoUserCode(values.code);
            setSsoType("device_code");
            setFetchingDetails(true);
            fetchSsoDetails()
              .catch(() => {
                message.error("Failed to fetch SSO details with provided code");
                setSsoUserCode(null);
              })
              .finally(() => {
                setFetchingDetails(false);
              });
          }}
        >
          <Form.Item
            name="code"
            label={t('auth.device-code')}
            rules={[{ required: true, message: t('auth.please-enter-the-code') }]}
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
            {t('continue')}
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
            {t('auth.you-have-logged-in-to')} {ssoDetails.appName}.
            <br />
            {t('auth.you-can-close-this-window-now')}
          </Text>
          <Button type="default" onClick={() => window.close()}>
            {t('auth.close-window')}
          </Button>
        </div>
      </Card>
    );
  }

  if (ssoDetails.status === "denied") {
    return (
      <Card className="max-w-sm w-full shadow-2xl">
        <div className="text-center py-8">
          <CircleX className="mb-4 mx-auto" size={64} />
          <Title level={3}>{t('auth.canceled')}</Title>
          <Text className="block mb-6">
            {t('auth.log-in-to')} {ssoDetails.appName} {t('auth.was-cancelled')}
            <br />
            {t('auth.you-can-close-this-window-now')}
          </Text>
          <Button type="default" onClick={() => window.close()}>
            {t('auth.close-window')}
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
            <Text type="secondary">{t('auth.wants-to-access-your-account')}</Text>
            {storeSsoType === "device_code" && (
              <Text type="warning" className="mt-4">
                {t('auth.make-sure-you-trust-the-device-you-are-connecting-to')}
              </Text>
            )
            }
          </div>

          <Divider style={{ margin: 0 }} />

          <div className="text-left bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
            <Text
              type="secondary"
              className="text-xs uppercase font-bold tracking-wider"
            >
              {t('auth.signed-in-as')}
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
            onClick={() => handleConfirmSSO(true)}
            loading={confirming}
          >
            <ArrowRight />
            {t('auth.continue-to')} {ssoDetails.appName}
          </Button>
          <div>
            <Button type="text" onClick={handleChangeAccount}>
              {t('auth.change-account')}
            </Button>
            <Divider type="vertical" />
            <Button
              type="text"
              onClick={() => handleConfirmSSO(false)}
              loading={denying}
            >
              {t('cancel')}
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
          {t('auth.there-was-an-error-logging-in-to')} {ssoDetails.appName}.
          <br />
          {t('auth.please-try-again')}
        </Text>
        <Button type="default" onClick={() => window.close()}>
          {t('auth.close-window')}
        </Button>
      </div>
    </Card>
  );
}

export default AuthorizePage;
