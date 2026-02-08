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
  Table,
  Typography,
  message,
} from "antd";
import { EditOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";

import {
  IdCardIcon,
  MailIcon,
  UserCircle,
  TagIcon,
  AppWindowIcon,
  ShieldEllipsis,
  PlusIcon,
  ClockIcon,

} from "lucide-react";
import dayjs from 'dayjs';

import type { LoginHistoryItem } from "../types";
import api from "../api/client";
import type { SimpleResponse } from "../types";
import { useAppStore } from "../store/useAppStore";

const { Title, Text } = Typography;

function DashboardPage() {
  const { profile, myApps: apps, fetchMyApps, updateProfile } = useAppStore();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [appsSummary, setAppsSummary] = useState<LoginHistoryItem[]>([]);

  useEffect(() => {
    fetchMyApps();
    fetchLoginHistory();
  }, []);

  const fetchLoginHistory = async () => {
    try {
      const { data } = await api.get<{ data: { history: LoginHistoryItem[], summary: LoginHistoryItem[] } }>(
        "/user/history"
      );
      // Handle both new format (map) and potentially old format (array direct) if transition logic needed?
      // Assuming backend deployed same time.
      if (data.data && !Array.isArray(data.data)) {
          setLoginHistory(data.data.history || []);
          setAppsSummary(data.data.summary || []);
      } else {
        // Fallback if backend not updated or returns array
        const list = (data.data as any) || [];
        setLoginHistory(list);
      }
    } catch (e) {
      // ignore
    }
  };

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
                <UserCircle color="#5c4bff" size={16} />
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

      <Divider className="my-6" />

      {/* App Usage Summary */}
      <Space direction="vertical" style={{ width: '100%' }} className="mb-8">
        <Space align="center" size={12}>
          <AppWindowIcon color="#5c4bff" size={16} />
          <Text strong className="text-base">Applications Logged Into</Text>
        </Space>
        
        <Row gutter={[16, 16]} className="mt-4">
          {appsSummary.map((app) => (
             <Col xs={24} sm={12} md={8} lg={6} key={app.app}>
               <Card size="small" className="hover:shadow-md transition-shadow">
                 <div className="flex flex-col gap-2">
                   <Flex align="center" gap={10}>
                    <Avatar src={app.logoUrl}>{app.app.charAt(0).toUpperCase()}</Avatar>
                    <Text strong>{app.app}</Text>
                   </Flex>
                   <div className="text-xs text-gray-500">
                     Last Login: <br />
                     {dayjs(app.time).format("YYYY-MM-DD HH:mm")}
                   </div>
                 </div>
               </Card>
             </Col>
          ))}
          {appsSummary.length === 0 && <Text type="secondary" className="pl-4">No login history found.</Text>}
        </Row>
      </Space>

      <Space direction="vertical" style={{ width: '100%' }}>
        <Space align="center" size={12}>
          <ClockIcon size={16} color='#5c4bff' />
          <Text strong className="text-base">Recent Login History (7 Days)</Text>
        </Space>
        
        <Table
          dataSource={loginHistory}
          rowKey={(record) => record.time + record.app}
          pagination={false}
          size="small"
          columns={[
            {
              title: "Application",
              dataIndex: "app",
              key: "appName"
            },
            {
              title: "Time",
              dataIndex: "time",
              key: "time",
              render: (text: string) => dayjs(text).format("YYYY-MM-DD HH:mm:ss"),
            },
          ]}
        />
      </Space>
    </Card>
  );
}

export default DashboardPage;
