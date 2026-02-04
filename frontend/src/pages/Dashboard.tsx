import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Input,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  LogoutOutlined,
  MailOutlined,
  UserOutlined,
  IdcardOutlined,
  EditOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import api from "../api/client";

const { Title, Text } = Typography;

type SimpleResponse = {
  status: number;
  message?: string;
};

type Props = {
  onLogout: () => void;
};

type Profile = {
  username: string;
  nickname?: string;
  email: string;
  avatarUrl?: string;
};

function DashboardPage({ onLogout }: Props) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [editing, setEditing] = useState<{
    avatar: boolean;
    nickname: boolean;
  }>({
    avatar: false,
    nickname: false,
  });

  const [nicknameInput, setnicknameInput] = useState("");
  const [avatarInput, setAvatarInput] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const data = await fetchProfile();
      if (data) {
        setProfile(data);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (!profile) return;
    setnicknameInput(profile.nickname || "");
    setAvatarInput(profile.avatarUrl || "");
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get<{ status: number; data: Profile }>("/myprofile");
      return data.data;
    } catch (error) {
      message.error("Could not fetch profile data");
      return null;
    }
  };

  const toggleEditing = (field: keyof typeof editing, value: boolean) => {
    setEditing((prev) => ({ ...prev, [field]: value }));
    if (field === "nickname") {
      setnicknameInput(profile?.nickname || "");
    }
    if (field === "avatar") {
      setAvatarInput(profile?.avatarUrl || "");
    }
  };

  const handlenicknameSave = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) {
      message.warning("nickname cannot be empty");
      return;
    }

    setLoadingKey("nickname");
    try {
      const { data } = await api.post<SimpleResponse>("/profile/nickname", {
        nickname: trimmed,
      });
      setProfile((prev) => (prev ? { ...prev, nickname: trimmed } : prev));
      message.success(data?.message || "nickname updated");
      toggleEditing("nickname", false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || "Could not update nickname");
    } finally {
      setLoadingKey(null);
    }
  };

  const handleAvatarSave = async () => {
    const trimmed = avatarInput.trim();
    if (!trimmed) {
      message.warning("Avatar URL cannot be empty");
      return;
    }

    setLoadingKey("avatar");
    try {
      const { data } = await api.post<SimpleResponse>("/profile/avatar", {
        avatarUrl: trimmed,
      });
      setProfile((prev) => (prev ? { ...prev, avatarUrl: trimmed } : prev));
      message.success(data?.message || "Avatar updated");
      toggleEditing("avatar", false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || "Could not update avatar");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px 24px",
        background:
          "linear-gradient(135deg, #f4f0ff 0%, #f8fbff 60%, #eef2ff 100%)",
      }}
    >
      <Card
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          borderRadius: 18,
          background: "rgba(255, 255, 255, 0.95)",
          boxShadow: "0 30px 120px rgba(76, 29, 149, 0.18)",
        }}
        bodyStyle={{ padding: 32 }}
      >
        <Flex justify="space-between" align="center" wrap>
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              Dashboard
            </Title>
            <Text type="secondary">Manage your profile and credentials</Text>
          </Space>
          <Button icon={<LogoutOutlined />} onClick={onLogout}>
            Logout
          </Button>
        </Flex>

        <Divider style={{ margin: "24px 0" }} />

        <Row gutter={[24, 24]} align="stretch">
          <Col xs={24} lg={10}>
            <div
              style={{
                background: "#fff",
                borderRadius: 22,
                padding: 24,
                minHeight: 320,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 20px 60px rgba(15, 12, 41, 0.12)",
              }}
            >
              <Space direction="vertical" size={16}>
                <Avatar
                  size={96}
                  src={profile?.avatarUrl}
                  style={{ backgroundColor: "#ffffff", border: "1px solid #eee" }}
                >
                  {profile?.username?.charAt(0).toUpperCase() || "U"}
                </Avatar>
                <Text type="secondary">It&apos;s all yours</Text>
                <Text strong style={{ fontSize: 20 }}>
                  {profile?.nickname || profile?.username || "Loading profile"}
                </Text>
              </Space>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Space align="center" size={10}>
                  <IdcardOutlined style={{ color: "#5c4bff" }} />
                  <Text>{profile?.username || "—"}</Text>
                </Space>
                <Space align="center" size={10}>
                  <MailOutlined style={{ color: "#5c4bff" }} />
                  <Text>{profile?.email || "—"}</Text>
                </Space>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={14}>
            <div
              style={{
                background: "#fff",
                borderRadius: 22,
                padding: 24,
                minHeight: 320,
                boxShadow: "0 20px 60px rgba(15, 12, 41, 0.12)",
              }}
            >
              <Space direction="vertical" size={32} style={{ width: "100%" }}>
                <div>
                  <Space align="center" size={12}>
                    <UserOutlined style={{ color: "#5c4bff" }} />
                    <Text strong style={{ fontSize: 16 }}>
                      nickname
                    </Text>
                  </Space>
                  <div style={{ marginTop: 14 }}>
                    {editing.nickname ? (
                      <Space wrap align="center">
                        <Input
                          value={nicknameInput}
                          onChange={(event) => setnicknameInput(event.target.value)}
                          placeholder="Set a friendly nickname"
                          style={{ minWidth: 190 }}
                        />
                        <Button
                          type="primary"
                          icon={<CheckOutlined />}
                          loading={loadingKey === "nickname"}
                          onClick={handlenicknameSave}
                        >
                          Save
                        </Button>
                        <Button type="default" onClick={() => toggleEditing("nickname", false)}>
                          Cancel
                        </Button>
                      </Space>
                    ) : (
                      <Space wrap align="center">
                        <Text type="secondary">
                          {profile?.nickname || "No nickname yet"}
                        </Text>
                        <Button
                          type="link"
                          icon={<EditOutlined />}
                          onClick={() => toggleEditing("nickname", true)}
                        >
                          Update
                        </Button>
                      </Space>
                    )}
                  </div>
                </div>
                <Divider style={{ margin: 0 }} />
                <div>
                  <Space align="center" size={12}>
                    <Avatar size={18} style={{ backgroundColor: "#dbe7ff" }}>
                      <UserOutlined />
                    </Avatar>
                    <Text strong style={{ fontSize: 16 }}>
                      Avatar URL
                    </Text>
                  </Space>
                  <div style={{ marginTop: 14 }}>
                    {editing.avatar ? (
                      <Space wrap align="center">
                        <Input
                          value={avatarInput}
                          onChange={(event) => setAvatarInput(event.target.value)}
                          placeholder="https://example.com/avatar.jpg"
                          style={{ minWidth: 220 }}
                        />
                        <Button
                          type="primary"
                          icon={<CheckOutlined />}
                          loading={loadingKey === "avatar"}
                          onClick={handleAvatarSave}
                        >
                          Save
                        </Button>
                        <Button type="default" onClick={() => toggleEditing("avatar", false)}>
                          Cancel
                        </Button>
                      </Space>
                    ) : (
                      <Space wrap align="center">
                        <Text type="secondary">
                          {profile?.avatarUrl ? "Custom URL linked" : "No avatar set"}
                        </Text>
                        <Button
                          type="link"
                          icon={<EditOutlined />}
                          onClick={() => toggleEditing("avatar", true)}
                        >
                          Update
                        </Button>
                      </Space>
                    )}
                  </div>
                </div>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default DashboardPage;
