import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  Space,
  Typography,
  App,
  Avatar,
  Divider,
} from "antd";
import {
  UserOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";
import { useAppStore } from "../store/useAppStore";

const { Title, Text } = Typography;

function AuthorizePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();

  const {
    ssoSessionId: storeSsoId,
    setSsoSessionId,
    ssoDetails,
    fetchSsoDetails,
    ssoConfirm,
    profile,
    token,
    logout,
  } = useAppStore();

  const urlSsoId = searchParams.get("sso");
  const urlFrom = searchParams.get("from");
  
  // Prioritize URL params
  const ssoSessionId = urlSsoId || storeSsoId;

  const [confirming, setConfirming] = useState(false);

  // Sync URL ID to store if needed
  useEffect(() => {
    if (urlSsoId && urlSsoId !== storeSsoId) {
      setSsoSessionId(urlSsoId);
    }
  }, [urlSsoId, storeSsoId, setSsoSessionId]);

  // Auth & Session Check
  useEffect(() => {
    if (!token && ssoSessionId) {
      // Not authenticated, redirect to logic with params
      const fromParam = urlFrom ? `&from=${encodeURIComponent(urlFrom)}` : "";
      navigate(`/login?sso=${ssoSessionId}${fromParam}`, { replace: true });
    } else if (!ssoSessionId) {
      // No SSO session, go to dashboard
      navigate("/dashboard", { replace: true });
    }
  }, [token, ssoSessionId, urlFrom, navigate]);

  // Fetch Details
  useEffect(() => {
    if (ssoSessionId && token) {
      fetchSsoDetails().catch(() => {
        message.error("Failed to fetch SSO details");
        setSsoSessionId(null);
        navigate("/dashboard");
      });
    }
  }, [ssoSessionId, token]);

  const handleConfirmSSO = async () => {
    if (!ssoSessionId) return;
    setConfirming(true);
    try {
      const confirmData = await ssoConfirm(!!urlFrom);
      setSsoSessionId(null);
      message.success(`Logged in to ${ssoDetails?.appName}`);
      
      if (urlFrom) {
        let redirectUrl = urlFrom;
        const code = (confirmData as any)?.authCode;
        if (code) {
          const separator = urlFrom.includes("?") ? "&" : "?";
          redirectUrl += `${separator}code=${encodeURIComponent(code)}`;
        }

        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);
      }
    } catch (e) {
      message.error("Failed to confirm login");
    } finally {
      setConfirming(false);
    }
  };

  if (!ssoSessionId || !ssoDetails) {
      // Can show loading or null while effect redirects/fetches
      return null;
  }

  if (ssoDetails.status === "confirmed") {
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

  return (
    <Card className="max-w-sm w-full shadow-2xl">
      <Space orientation="vertical" size="large" className="w-full text-center">
        <div className="flex flex-col items-center">
          <Avatar
            size={64}
            src={ssoDetails.logoUrl}
            style={{ margin: "10px" }}
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

export default AuthorizePage;
