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
  Modal,
  Form,
  Upload,
  DatePicker,
} from "antd";
import { EditOutlined, CheckOutlined, CloseOutlined, UploadOutlined } from "@ant-design/icons";
import ImgCrop from "antd-img-crop";
import dayjs from "dayjs";
import { config } from "../config";

import {
  IdCardIcon,
  MailIcon,
  UserCircle,
  TagIcon,
  AppWindowIcon,
  ShieldEllipsis,
  PlusIcon,
  ClockIcon,
  KeyRound,
} from "lucide-react";
import { formatDateTime } from "../utils/date";

import type { ErrorResponse, LoginHistoryItem } from "../types";
import api from "../api/client";
import type { SimpleResponse } from "../types";
import { useAppStore } from "../store/useAppStore";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

function DashboardPage() {
  const { profile, myApps: apps, fetchMyApps, updateProfile } = useAppStore();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [appsSummary, setAppsSummary] = useState<LoginHistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    fetchMyApps();
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchLoginHistory(selectedDate);
  }, [selectedDate]);

  const fetchSummary = async () => {
    try {
      const { data } = await api.get("/user/apps/summary");
      setAppsSummary(data.data || []);
    } catch {
      // ignore
    }
  }

  const fetchLoginHistory = async (date: dayjs.Dayjs | null) => {
    try {
        let url = "/user/history";
        if (date) {
             const dateStr = date.format("YYYY-MM-DD");
             // Send standard offset in minutes (Local - UTC)? 
             // Go expects minutes offset. UTC+8 = 480.
             // date.utcOffset() is minutes from UTC (e.g. 480 for UTC+8)
             const offset = date.utcOffset(); 
             url += `?date=${dateStr}&offset=${offset}`;
        }
      const { data } = await api.get<{ data: LoginHistoryItem[] }>(url);
      setLoginHistory(data.data || []);
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
    setLoadingKey("avatar");
    try {
      let dataResp;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const { data } = await api.post<SimpleResponse & { data: { avatarUrl: string } }>("/profile/avatar", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        dataResp = data;
      } else {
        const trimmed = avatarInput.trim();
        const { data } = await api.post<SimpleResponse & { data: { avatarUrl: string } }>("/profile/avatar", {
          avatarUrl: trimmed,
        });
        dataResp = data;
      }

      let newUrl = dataResp.data?.avatarUrl || avatarInput;
      // Prepend API_URL if relative path (blob)
      if (newUrl.startsWith("/blob/") && config.API_URL) {
           newUrl = config.API_URL.replace(/\/$/, "") + newUrl;
      }

      updateProfile({ avatarUrl: newUrl });
      message.success(dataResp?.message || "Avatar updated");
      toggleEditing("avatar", false);
      setSelectedFile(null);
    } catch (error: unknown) {
      const err = error as ErrorResponse;
      message.error(err.response?.data?.message || "Could not update avatar");
    } finally {
      setLoadingKey(null);
    }
  };

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm] = Form.useForm();

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailForm] = Form.useForm();

  const handlePasswordChange = async () => {
    try {
      const values = await passwordForm.validateFields();
      await api.post("/profile/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success("Password updated successfully");
      setIsPasswordModalOpen(false);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Failed to update password");
    }
  };

  const handleEmailChange = async () => {
    try {
      const values = await emailForm.validateFields();
      await api.post("/profile/email/change", {
        password: values.password,
        newEmail: values.newEmail,
      });
      message.success("Verification email sent to new address");
      setIsEmailModalOpen(false);
      emailForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Failed to request email change");
    }
  };

  if (!profile) {
    return (
      <div className="p-10 text-center">Loading Profile...</div>
    );
  }

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
              {profile?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Text strong className="text-xl">
              {profile?.nickname || profile?.username || "—"}
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
                      {profile?.nickname || "No nickname set"}
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
                  <Space>
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
                    <ImgCrop rotationSlider>
                      <Upload
                        showUploadList={false}
                        customRequest={({ file, onSuccess }) => {
                          const f = file as File;
                          setSelectedFile(f);
                          setAvatarInput(URL.createObjectURL(f));
                          message.info("Image selected. Click check to save.");
                          onSuccess?.("ok");
                        }}
                      >
                        <Button icon={<UploadOutlined />}>Select</Button>
                      </Upload>
                    </ImgCrop>
                  </Space>
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

            <div>
              <Space align="center" size={12}>
                <MailIcon color="#5c4bff" size={16} />
                <Text strong className="text-base">
                  Email
                </Text>
              </Space>
              <div className="mt-[14px]">
                <Text type="secondary" className="mr-4">{profile?.email || "No Email"}</Text>
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => setIsEmailModalOpen(true)}
                  className="pl-0"
                >
                  Change Email
                </Button>
              </div>
            </div>

            <div>
              <Space align="center" size={12}>
                <KeyRound color="#5c4bff" size={16} />
                <Text strong className="text-base">
                  Password
                </Text>
              </Space>
              <div className="mt-[14px]">
                <Button
                  type="link"
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="pl-0"
                >
                  Change Password
                </Button>
                <Link to="/forget" className="ml-4">
                  Forgot Password
                </Link>
              </div>
            </div>

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
                     {formatDateTime(app.time)}
                   </div>
                 </div>
               </Card>
             </Col>
          ))}
          {appsSummary.length === 0 && <Text type="secondary" className="pl-4">No login history found.</Text>}
        </Row>
      </Space>

      <Space direction="vertical" style={{ width: '100%' }}>
        <Flex justify="space-between" align="center">
          <Space align="center" size={12}>
            <ClockIcon size={16} color='#5c4bff' />
            <Text strong className="text-base">Login History</Text>
          </Space>
          <DatePicker 
             value={selectedDate} 
             onChange={setSelectedDate} 
             placeholder="Select Date"
             allowClear
          />
        </Flex>
        
        <Table
          dataSource={loginHistory}
          rowKey={(record) => record.time + record.app + Math.random()}
          pagination={{ pageSize: 5 }}
          size="small"
          locale={{ emptyText: "No history found" }}
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
              render: (text: string) => formatDateTime(text),
            },
          ]}
        />
      </Space>

      <Modal
        title="Change Password"
        open={isPasswordModalOpen}
        onOk={handlePasswordChange}
        onCancel={() => {
          setIsPasswordModalOpen(false);
          passwordForm.resetFields();
        }}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="currentPassword"
            label="Current Password"
            rules={[{ required: true, message: "Please enter your current password" }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: "Please enter a new password" },
              { min: 8, message: "Password must be at least 8 characters" }
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Change Email"
        open={isEmailModalOpen}
        onOk={handleEmailChange}
        onCancel={() => {
          setIsEmailModalOpen(false);
          emailForm.resetFields();
        }}
      >
        <Form form={emailForm} layout="vertical">
          <Form.Item
            name="newEmail"
            label="New Email"
            rules={[
              { required: true, message: "Please enter your new email" },
              { type: "email", message: "Please enter a valid email" }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Current Password"
            rules={[{ required: true, message: "Please enter your current password" }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default DashboardPage;
