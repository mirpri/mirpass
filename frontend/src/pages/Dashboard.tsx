import { useEffect, useState } from "react";
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
  Typography,
  message,
} from "antd";
import { EditOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";

import {
  IdCardIcon,
  MailIcon,
  UserIcon,
  TagIcon,
  AppWindowIcon,
  ShieldEllipsis,
  PlusIcon,
} from "lucide-react";
import api from "../api/client";
import type { SimpleResponse } from "../types";
import { useAppStore } from "../store/useAppStore";

const { Title, Text } = Typography;

function DashboardPage() {
  const { profile, myApps: apps, fetchMyApps, updateProfile } = useAppStore();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

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
    // Profile is auto-fetched in App.tsx now
    fetchMyApps();
  }, []);

  useEffect(() => {
    if (!profile) return;
    setnicknameInput(profile.nickname || "");
    setAvatarInput(profile.avatarUrl || "");
  }, [profile]);

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
      // Update store instead of local state
      updateProfile({ nickname: trimmed });
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
      updateProfile({ avatarUrl: trimmed });
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
    <Card className="mx-auto max-w-4xl w-full rounded-[18px] bg-white/95 shadow-xl p-8">
      <Flex justify="space-between" align="center" wrap>
        <Space direction="vertical" size={4}>
          <Title level={3} className="m-0">
            Dashboard
          </Title>
          <Text type="secondary">Manage your profile and credentials</Text>
        </Space>
      </Flex>

      <Divider className="my-6" />

      <Row gutter={[24, 24]} align="stretch">
        <Col xs={24} sm={9}>
          <Space direction="vertical" size={16} className="w-full p-4">
            <Avatar size={96} src={profile?.avatarUrl} className="shadow-lg">
              {profile?.username?.charAt(0).toUpperCase() || "U"}
            </Avatar>
            <Text strong className="text-xl">
              {profile?.nickname || profile?.username || "Loading profile"}
            </Text>
            <div className="flex flex-col gap-3">
              <Space align="center" size={10}>
                <IdCardIcon color="#5c4bff" size={16} />
                <Text>{profile?.username || "—"}</Text>
              </Space>
              <Space align="center" size={10}>
                <MailIcon color="#5c4bff" size={16} />
                <Text>{profile?.email || "—"}</Text>
              </Space>
            </div>
          </Space>
        </Col>
        <Col xs={24} sm={15}>
          <Space direction="vertical" size={32} className="w-full p-4">
            <div>
              <Space align="center" size={12}>
                <TagIcon color="#5c4bff" size={16} />
                <Text strong className="text-base">
                  Nickname
                </Text>
              </Space>
              <div className="mt-[14px]">
                {editing.nickname ? (
                  <Space.Compact>
                    <Input
                      value={nicknameInput}
                      onChange={(event) => setnicknameInput(event.target.value)}
                      placeholder="Set a nickname"
                      className="min-w-[190px]"
                    />
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      loading={loadingKey === "nickname"}
                      onClick={handlenicknameSave}
                    />
                    <Button
                      icon={<CloseOutlined />}
                      type="default"
                      onClick={() => toggleEditing("nickname", false)}
                    />
                  </Space.Compact>
                ) : (
                  <Space align="center">
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
            <div>
              <Space align="center" size={12}>
                <UserIcon color="#5c4bff" size={16} />
                <Text strong className="text-base">
                  Avatar
                </Text>
              </Space>
              <div className="mt-[14px]">
                {editing.avatar ? (
                  <Space.Compact>
                    <Input
                      value={avatarInput}
                      onChange={(event) => setAvatarInput(event.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="min-w-[220px]"
                    />
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      loading={loadingKey === "avatar"}
                      onClick={handleAvatarSave}
                    />
                    <Button
                      icon={<CloseOutlined />}
                      type="default"
                      onClick={() => toggleEditing("avatar", false)}
                    />
                  </Space.Compact>
                ) : (
                  <Space wrap align="center">
                    <Text type="secondary">
                      {profile?.avatarUrl
                        ? "Custom URL linked"
                        : "No avatar set"}
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

            <Divider />

            <div>
              <Space align="center" size={12}>
                <AppWindowIcon color="#5c4bff" size={16} />
                <Text strong className="text-base">
                  My Applications
                </Text>
              </Space>
              <div className="mt-[14px]">
                {apps.map((app) => (
                  <Button
                    key={app.appId}
                    className="m-1"
                    href={
                      app.name === "system" ? "/manage" : `/manage/${app.appId}`
                    }
                  >
                    <ShieldEllipsis size={14} />
                    {app.name}
                  </Button>
                ))}
                <Button type="dashed" href="/apps/create" className="m-1">
                  <PlusIcon size={14} />
                  Create New App
                </Button>
              </div>
            </div>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

export default DashboardPage;
