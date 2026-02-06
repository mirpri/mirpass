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
import {
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";

import {
  LogOutIcon,
  IdCardIcon,
  MailIcon,
  UserIcon,
  TagIcon,
  AppWindowIcon,
  PlusIcon,
  ShieldEllipsis
} from "lucide-react"
import api from "../api/client";
import type { AppRole, Profile, SimpleResponse } from "../types";

const { Title, Text } = Typography;

type Props = {
  onLogout: () => void;
};

function DashboardPage({ onLogout }: Props) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<AppRole[]>([]);

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
    fetchMyApps();
  }, []);

  const fetchMyApps = async () => {
    try {
      const { data } = await api.get<{ data: AppRole[] }>("/myapps");
      setApps(data.data || []);
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    if (!profile) return;
    setnicknameInput(profile.nickname || "");
    setAvatarInput(profile.avatarUrl || "");
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get<{ status: number; data: Profile }>(
        "/myprofile",
      );
      return data.data;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = err.response?.status;
      if (status === 401) {
        message.error("Session expired. Please log in again.");
        onLogout();
        return null;
      }
      const msg = err.response?.data?.message;
      message.error(msg || `Could not fetch profile data`);
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
    <div className="min-h-screen py-8 px-6 bg-purple-60 flex items-center justify-center">
      <Card className="mx-auto max-w-4xl w-full rounded-[18px] bg-white/95 shadow-xl p-8">
        <Flex justify="space-between" align="center" wrap>
          <Space direction="vertical" size={4}>
            <Title level={3} className="m-0">
              Dashboard
            </Title>
            <Text type="secondary">Manage your profile and credentials</Text>
          </Space>
          <Space>
            <Button icon={<LogOutIcon size={13} />} onClick={onLogout}>
              Logout
            </Button>
          </Space>
        </Flex>

        <Divider className="my-6" />

        <Row gutter={[24, 24]} align="stretch">
          <Col xs={24} lg={10}>
            <div className="bg-white rounded-2xl p-6 min-h-[280px] flex flex-col justify-between border-solid border-1 border-gray-200">
              <Space direction="vertical" size={16}>
                <Avatar
                  size={96}
                  src={profile?.avatarUrl}
                  className="shadow-lg"
                >
                  {profile?.username?.charAt(0).toUpperCase() || "U"}
                </Avatar>
                <Text strong className="text-xl">
                  {profile?.nickname || profile?.username || "Loading profile"}
                </Text>
              </Space>
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
            </div>
          </Col>
          <Col xs={24} lg={14}>
            <div className="bg-white rounded-2xl p-6 min-h-[280px] flex flex-col justify-between border-solid border-1 border-gray-200">
              <Space direction="vertical" size={32} className="w-full">
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
                          onChange={(event) =>
                            setnicknameInput(event.target.value)
                          }
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
                          onChange={(event) =>
                            setAvatarInput(event.target.value)
                          }
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
                        className="mr-2"
                        href={
                          app.name === "system"
                            ? "/manage"
                            : `/manage/${app.appId}`
                        }
                      >
                        <ShieldEllipsis size={14} />
                        {app.name}
                      </Button>
                    ))}
                    <Button type="dashed" href="/apps/create">
                    <PlusIcon size={14} />
                      Create New App
                    </Button>
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
