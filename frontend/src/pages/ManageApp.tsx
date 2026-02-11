import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { ErrorResponse } from "../types";
import {
  Button,
  Card,
  Table,
  Typography,
  message,
  Modal,
  Tag,
  Space,
  Input,
  Tabs,
  Form,
  Select,
  Popconfirm,
  Divider,
  Statistic,
  Row,
  Col,
  DatePicker,
  Alert,
  Upload,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  UserAddOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { BanIcon, CopyIcon } from "lucide-react";
import ImgCrop from "antd-img-crop";

import dayjs from "dayjs";
import { formatDateTime, toUtcDateString } from "../utils/date";

import api from "../api/client";
import { config } from "../config";
import type {
  APIKey,
  AppDetails,
  AppMember,
  LoginHistoryItem,
  AppStatsSummary,
} from "../types";
import { useAppStore } from "../store/useAppStore";
import { LoadingView } from "../components/LoadingView";
import { FailedView } from "../components/FailedView";
import { AnyAvatar } from "../components/Avatars";

const { Title, Text, Paragraph } = Typography;

function ManageAppPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<AppDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (appId) {
      loadApp();
    }
  }, [appId]);

  const loadApp = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: AppDetails }>(
        `/apps/details?id=${appId}`,
      );
      setApp(data.data);
    } catch (e) {
      message.error("Could not load app details");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingView />;
  if (!app) return <FailedView />;

  const items = [
    {
      key: "stats",
      label: "Analytics",
      children: <StatsTab app={app} />,
    },
    {
      key: "keys",
      label: "API Keys",
      children: <KeysTab app={app} />,
    },
    {
      key: "members",
      label: "Members",
      children: <MembersTab app={app} />,
    },
    {
      key: "help",
      label: "Integration Guide",
      children: <IntegrationGuideTab app={app} />,
    },
    {
      key: "settings",
      label: "Settings",
      children: (
        <SettingsTab
          app={app}
          onUpdate={loadApp}
          onDelete={() => navigate("/dashboard")}
        />
      ),
    },
  ];

  return (
    <Card
      className="max-w-5xl w-full shadow-xl"
      title="Manage Application"
      extra={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Back
        </Button>
      }
    >
      <Space size={10} align="center" className="mb-3">
        <AnyAvatar size={48} url={{url: app.logoUrl, text: app.name}} />
        <Title level={3} style={{ marginBottom: 0 }}>
          {app.name}
        </Title>
        <Tag color="blue">{app.role}</Tag>
      </Space>
      {app.suspendUntil && dayjs(app.suspendUntil).isAfter(dayjs()) && (
        <Alert
          type="error"
          title={
            "This app is suspended until " + formatDateTime(app.suspendUntil)
          }
        />
      )}
      <Tabs defaultActiveKey="stats" items={items} />
    </Card>
  );
}

// --- Keys Tab ---

function KeysTab({ app }: { app: AppDetails }) {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");

  // Result Modal
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState("");

  useEffect(() => {
    fetchKeys();
  }, [app.id]);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: APIKey[] }>(
        `/apps/keys?id=${app.id}`,
      );
      setKeys(data.data || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    try {
      const { data } = await api.post<{ data: { key: string } }>(
        "/apps/keys/create",
        {
          appId: app.id,
          name: keyName,
        },
      );
      setNewKeyValue(data.data.key);
      setCreateModalOpen(false);
      setResultModalOpen(true);
      setKeyName("");
      fetchKeys();
    } catch (e) {
      message.error("Failed to create API key");
    }
  };

  const deleteKey = async (keyId: number) => {
    try {
      await api.post("/apps/keys/delete", { appId: app.id, keyId });
      message.success("Key deleted");
      fetchKeys();
    } catch (e) {
      message.error("Could not delete key");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) => text || <Text type="secondary">Unnamed</Text>,
    },
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
    },
    {
      title: "Created At",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (text: string) => formatDateTime(text),
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: APIKey) => (
        <Popconfirm
          title="Delete this key?"
          onConfirm={() => deleteKey(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button danger size="small" icon={<DeleteOutlined />}>
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Text>Manage your API keys for accessing the service.</Text>
        {app.role !== "external" && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create New Key
          </Button>
        )}
      </div>

      <Table
        dataSource={keys}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      {/* Creation Modal */}
      <Modal
        title="Create New API Key"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateKey}
        okText="Create"
      >
        <Form layout="vertical">
          <Form.Item label="Key Name (Optional)">
            <Input
              placeholder="e.g. Production Key"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Result Modal */}
      <Modal
        title="API Key Created"
        open={resultModalOpen}
        onCancel={() => setResultModalOpen(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setResultModalOpen(false)}
          >
            Done
          </Button>,
        ]}
      >
        <div className="flex flex-col gap-2">
          <Text type="secondary">
            Copy this key now. You won't see it again.
          </Text>
          <Space.Compact style={{ width: "100%" }}>
            <Input value={newKeyValue} readOnly />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(newKeyValue);
                message.success("Copied to clipboard");
              }}
            >
              <CopyIcon size={16} />
            </Button>
          </Space.Compact>
        </div>
      </Modal>
    </div>
  );
}

// --- Members Tab ---

function MembersTab({ app }: { app: AppDetails }) {
  const [members, setMembers] = useState<AppMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Add Member Form
  const [newUser, setNewUser] = useState("");
  const [newRole, setNewRole] = useState("admin");

  const { profile } = useAppStore();

  useEffect(() => {
    fetchMembers();
  }, [app.id]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: AppMember[] }>(
        `/apps/members?id=${app.id}`,
      );
      setMembers(data.data || []);
    } catch (e) {
      // message.error("Could not fetch members");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    try {
      await api.post("/apps/members/add", {
        appId: app.id,
        username: newUser,
        role: newRole,
      });
      message.success("Member added");
      setAddModalOpen(false);
      setNewUser("");
      fetchMembers();
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to add member";
      message.error(msg);
    }
  };

  const handleRemoveMember = async (username: string) => {
    try {
      await api.post("/apps/members/remove", {
        appId: app.id,
        username,
      });
      message.success("Member removed");
      fetchMembers();
    } catch (e) {
      message.error("Failed to remove member");
    }
  };

  const handleUpdateRole = async (username: string, role: string) => {
    try {
      await api.post("/apps/members/role", {
        appId: app.id,
        username,
        role,
      });
      message.success("Role updated");
      fetchMembers();
    } catch (e) {
      message.error("Failed to update role");
    }
  };

  const roleOptions = [
    { label: "Admin", value: "admin" },
    { label: "Root", value: "root" },
  ];

  const columns = [
    {
      title: "Username",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role: string) => {
        return <Tag color={role === "root" ? "gold" : "blue"}>{role}</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: AppMember) => {
        if (record.username === profile?.username) {
          return (
            <Space>
              <Popconfirm
                title={`Remove yourself? You'll lose access to this app!`}
                onConfirm={() => handleRemoveMember(record.username)}
                okText="Yes"
                cancelText="No"
              >
                <Button danger size="small" icon={<DeleteOutlined />}>
                  Leave
                </Button>
              </Popconfirm>
            </Space>
          );
        }
        if (app.role !== "root") {
          return <BanIcon size={18} />;
        }

        return (
          <Space>
            <Select
              value={record.role}
              onChange={(value) => handleUpdateRole(record.username, value)}
              options={roleOptions}
              size="small"
              className="w-20"
            />
            <Popconfirm
              title={`Remove ${record.username} from this app?`}
              onConfirm={() => handleRemoveMember(record.username)}
              okText="Yes"
              cancelText="No"
            >
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Text>Manage team members and their access levels.</Text>
        {app.role === "root" && (
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setAddModalOpen(true)}
          >
            Add Member
          </Button>
        )}
      </div>

      <Table
        dataSource={members}
        columns={columns}
        rowKey="username"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="Add New Member"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onOk={handleAddMember}
        okText="Add"
      >
        <Form layout="vertical">
          <Form.Item label="Username" required>
            <Input
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              placeholder="Username"
            />
          </Form.Item>
          <Form.Item label="Role" required>
            <Select value={newRole} onChange={setNewRole}>
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="root">Root</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// --- Settings Tab ---

function SettingsTab({
  app,
  onUpdate,
  onDelete,
}: {
  app: AppDetails;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    form.setFieldsValue({
      name: app.name,
      description: app.description,
      logoUrl: app.logoUrl,
    });
    setSelectedFile(null);
  }, [app]);

  const handleUpdate = async (values: any) => {
    setLoading(true);
    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("appId", app.id);
        formData.append("name", values.name);
        formData.append("description", values.description || "");
        formData.append("logoUrl", values.logoUrl || "");
        formData.append("file", selectedFile);

        await api.post("/apps/update", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/apps/update", {
          appId: app.id,
          name: values.name,
          description: values.description,
          logoUrl: values.logoUrl,
        });
      }
      message.success("App updated");
      onUpdate();
      setSelectedFile(null); // Reset file selection after success
    } catch (e) {
      console.error(e);
      message.error("Failed to update app");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.post("/apps/delete", { appId: app.id });
      message.success("App deleted");
      onDelete();
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to delete app";
      message.error(msg);
    }
  };

  const isRoot = app.role === "root";

  return (
    <div className="max-w-3xl">
      <Title level={4}>General Settings</Title>

      <Form form={form} layout="vertical" onFinish={handleUpdate}>
        <Form.Item
          label="App Name"
          name="name"
          rules={[{ required: true, message: "Please input app name!" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <Input.TextArea rows={4} />
        </Form.Item>

        <Form.Item label="Logo URL">
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item name="logoUrl" noStyle>
              <Input placeholder="https://example.com/logo.png" />
            </Form.Item>
            <ImgCrop rotationSlider>
              <Upload
                showUploadList={false}
                customRequest={({ file, onSuccess }) => {
                  const f = file as File;
                  setSelectedFile(f);
                  const blobUrl = URL.createObjectURL(f);
                  form.setFieldValue("logoUrl", blobUrl);
                  message.success("Logo selected. Click Save to apply.");
                  onSuccess?.("ok");
                }}
              >
                <Button icon={<UploadOutlined />}>Select</Button>
              </Upload>
            </ImgCrop>
          </Space.Compact>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={loading}
          >
            Save Changes
          </Button>
        </Form.Item>
      </Form>

      {isRoot && (
        <>
          <Divider />
          <div className="border border-red-200 dark:border-red-900 p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
            <Title level={5} type="danger">
              Danger Zone
            </Title>
            <Paragraph>
              Deleting this application will remove all associated data,
              including API keys and member associations. This action cannot be
              undone.
            </Paragraph>
            <Popconfirm
              title="Are you sure you want to delete this app?"
              description="This action cannot be undone."
              onConfirm={handleDelete}
              okText="Yes, delete it"
              okType="danger"
              cancelText="Cancel"
            >
              <Button type="primary" danger icon={<DeleteOutlined />}>
                Delete Application
              </Button>
            </Popconfirm>
          </div>
        </>
      )}
    </div>
  );
}

// --- Guide Tab ---

function IntegrationGuideTab({ app }: { app: AppDetails }) {
  const backendUrl = config.API_URL;
  if (backendUrl.endsWith("/")) {
    backendUrl.slice(0, -1);
  }
  const frontendUrl = window.location.origin;

  const [redirectUrl, setRedirectUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [deviceCodeData, setDeviceCodeData] = useState<any>(null);
  const [pollStatus, setPollStatus] = useState<string>("");
  const [pollResult, setPollResult] = useState<any>(null);

  const handleCreateTestSession = async () => {
    setDeviceCodeData(null);
    setPollResult(null);
    setPollStatus("Initiating...");
    try {
      // Use Device Flow
      const { data } = await api.post(
        "/oauth2/devicecode",
        { client_id: app.id },
        // Device flow is public typically, but we might want to check app suspension etc.
        // The backend handler checks app existence by client_id.
      );
      
      setDeviceCodeData(data);
      setPollStatus("Waiting for user authorization...");
      
      // Construct URL if verification_uri_complete provided
      let loginUrl = data.verification_uri_complete;
      if (loginUrl && redirectUrl) {
           // Not standard device flow, but for this "test" helper
           // However, device flow user code is usually entered manually or via magic link.
           // The backend returns keys as per RFC 8628? Yes map[string]string.
      }
      
      message.success("Session initiated");
      if (loginUrl) {
          window.open(loginUrl, "_blank");
      }
    } catch (error: unknown) {
      const err = error as ErrorResponse;
      // device flow errors might be different structure?
      // WriteErrorResponse wraps in {error: message} or standard wrapper.
      // handlers.WriteErrorResponse -> { status, message, error: ... } potentially?
      // handlers.WriteOauthErrorResponse -> { error: message }
      
      const msg = err.response?.error || "Failed";
      console.error("Failed to create test session", err);
      setPollStatus("Failed: " + msg);
    }
  };

  useEffect(() => {
    if (!deviceCodeData || pollResult) return;

    let timer: any;
    const intervalMs = (deviceCodeData.interval || 5) * 1000;

    const doPoll = async () => {
      try {
        const { data } = await api.post("/oauth2/token", {
          client_id: app.id,
          device_code: deviceCodeData.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        });
        
        // Success
        setPollResult(data);
        setPollStatus("Success! Token received.");
        message.success("Token received!");
        setDeviceCodeData(null); // Stop polling
      } catch (e: any) {
        const errCode = e.response?.data?.error;
        if (errCode === "authorization_pending") {
           // continue
           timer = setTimeout(doPoll, intervalMs);
        } else if (errCode === "slow_down") {
           setPollStatus("Slowing down...");
           timer = setTimeout(doPoll, intervalMs + 5000);
        } else {
           setPollStatus("Failed or Expired: " + (errCode || "Unknown"));
           setDeviceCodeData(null); 
        }
      }
    };

    timer = setTimeout(doPoll, intervalMs);
    return () => clearTimeout(timer);
  }, [deviceCodeData, pollResult, app.id]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Title level={3}>Mirpass SSO / Device Flow Integration</Title>
        <Paragraph>
          Integrate secure authentication into your application using
          Device Flow.
        </Paragraph>
        <Space orientation="vertical" className="w-full max-w-xl">
          <Input
            placeholder="API Key (Not needed for Device Flow init, but good for reference)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Input
            placeholder="Redirect URL (Optional, handled by User Code flow logic usually)"
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
          />
          <Button
            onClick={handleCreateTestSession}
            type="primary"
          >
            Create test session (Device Flow)
          </Button>
        </Space>
        
        <div className="mt-4">
            <Text strong>Status: </Text> <Text>{pollStatus}</Text>
        </div>
        {pollResult && (
           <div className="mt-2 bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200">
               <Text strong className="text-green-600">Access Token:</Text>
               <Paragraph className="break-all font-mono text-xs">{pollResult.access_token}</Paragraph>
               {pollResult.refresh_token && (
                   <>
                   <Text strong className="text-green-600">Refresh Token:</Text>
                   <Paragraph className="break-all font-mono text-xs">{pollResult.refresh_token}</Paragraph>
                   </>
               )}
           </div>
        )}
      </div>

      <div>
        <Title level={4}>1. Initiate Device Flow</Title>
        <Paragraph>
          Make a POST request to initiate the flow.
        </Paragraph>
        <div className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
          <span className="text-purple-400">POST</span> {backendUrl}/oauth2/devicecode
          <br />
          <span className="text-blue-300">Content-Type:</span> application/json
          <br />
          <br />
          {`{ "client_id": "${app.id}" }`}
        </div>
        <Paragraph className="mt-2 text-sm text-gray-500">
          Response:
        </Paragraph>
        <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm text-gray-600 dark:text-gray-300 font-mono">
          {`{
  "device_code": "...",
  "user_code": "WDJB-MJHT",
  "verification_uri": "${frontendUrl}/auth",
  "verification_uri_complete": "${frontendUrl}/auth?user_code=WDJB-MJHT",
  "expires_in": 900,
  "interval": 5
}`}
        </div>
      </div>

      <div>
        <Title level={4}>2. Poll for Token</Title>
        <Paragraph>
          Poll the token endpoint using the `device_code` until the user authorizes.
        </Paragraph>
        <div className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
          <span className="text-purple-400">POST</span> {backendUrl}/oauth2/token
          <br />
          <span className="text-blue-300">Content-Type:</span> application/json
          <br />
          <br />
          {`{
  "client_id": "${app.id}",
  "device_code": "...",
  "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
}`}
        </div>
        <Paragraph className="mt-2 text-sm text-gray-500">
          Response (Pending):
        </Paragraph>
        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono mb-2">
          {`{ "error": "authorization_pending" }`}
        </div>
        <Paragraph className="text-sm text-gray-500">
          Response (Success):
        </Paragraph>
        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono">
          {`{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}`}
        </div>
      </div>

    </div>
  );
}

// --- Stats Tab ---

function StatsTab({ app }: { app: AppDetails }) {
  const [summary, setSummary] = useState<AppStatsSummary | null>(null);
  const [history, setHistory] = useState<LoginHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    fetchStats();
  }, [app.id]);

  useEffect(() => {
    fetchHistory(selectedDate);
  }, [selectedDate, app.id]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: AppStatsSummary }>(
        `/apps/stats?id=${app.id}`,
      );
      setSummary(data.data);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (date: dayjs.Dayjs | null) => {
    let q = `/apps/history?id=${app.id}`;
    if (date) {
      q += `&date=${toUtcDateString(date)}&offset=${date.utcOffset()}`;
    }
    try {
      const { data } = await api.get<{ data: LoginHistoryItem[] }>(q);
      setHistory(data.data || []);
    } catch (e) {
      // ignore
    }
  };

  const chartData = useMemo(() => {
    if (!summary?.daily) return [];
    return summary.daily;
  }, [summary]);

  if (loading && !summary) return <div className="p-4">Loading stats...</div>;
  if (!summary) return <div className="p-4">No stats available.</div>;

  return (
    <div>
      <Card
        title="Summary"
        className="bg-white/90"
        style={{ margin: "10px 0" }}
      >
        <Row gutter={16} className="text-center">
          <Col xs={12} sm={6}>
            <Statistic title="Total Users" value={summary.totalUsers} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Total Logins" value={summary.totalLogins} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Active (24h)" value={summary.activeUsers24h} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="New (24h)" value={summary.newUsers24h} />
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col xs={24} xl={12}>
          <Card title="Traffic (Last 7 Days)" style={{ margin: "10px 0" }}>
            <div>
              <div className="flex items-end justify-between h-56 gap-2 px-2">
                {chartData.map((d) => {
                  const maxVal = Math.max(
                    ...chartData.map((cd) =>
                      // Include newUsers in scaling calculation
                      Math.max(cd.logins, cd.activeUsers, cd.newUsers),
                    ),
                  );
                  const scale = maxVal > 0 ? 160 / maxVal : 0;

                  return (
                    <div
                      key={d.date}
                      className="flex flex-col items-center gap-2 group w-full overflow-hidden"
                    >
                      <div className="flex gap-1 items-end h-[160px] w-full justify-center relative">
                        {/* Logins Bar */}
                        <div
                          className="bg-indigo-400 dark:bg-indigo-600 w-3 rounded-t transition-all hover:bg-indigo-300"
                          style={{
                            height: `${Math.max(d.logins * scale, 4)}px`,
                          }}
                          title={`Logins: ${d.logins}`}
                        />
                        {/* Active Users Bar */}
                        <div
                          className="bg-emerald-400 dark:bg-emerald-600 w-3 rounded-t transition-all hover:bg-emerald-300"
                          style={{
                            height: `${Math.max(d.activeUsers * scale, 4)}px`,
                          }}
                          title={`Active Users: ${d.activeUsers}`}
                        />
                        {/* New Users Bar */}
                        <div
                          className="bg-sky-400 dark:bg-sky-600 w-3 rounded-t transition-all hover:bg-sky-300"
                          style={{
                            height: `${Math.max(d.newUsers * scale, 4)}px`,
                          }}
                          title={`New Users: ${d.newUsers}`}
                        />
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap transform -rotate-45 origin-left mt-6 pl-4">
                        {dayjs.utc(d.date).format("MM-DD")}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center flex-wrap gap-x-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-indigo-400 rounded"></div>
                  <Text type="secondary" className="text-xs">
                    Logins
                  </Text>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-400 rounded"></div>
                  <Text type="secondary" className="text-xs">
                    Active Users
                  </Text>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-sky-400 rounded"></div>
                  <Text type="secondary" className="text-xs">
                    New Users
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            title="Login History"
            style={{ margin: "10px 0" }}
            extra={
              <DatePicker
                value={selectedDate}
                onChange={(date) => setSelectedDate(date ? date.utc() : null)}
                allowClear
              />
            }
          >
            {selectedDate && <Text>{history.length} activities found</Text>}
            <Table
              dataSource={history}
              size="small"
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: "No activity on selected date" }}
              columns={[
                {
                  title: "User",
                  dataIndex: "user",
                  key: "user",
                  render: (text: string) =>
                    text ? (
                      <span className="flex items-center gap-2">{text}</span>
                    ) : (
                      <Text type="secondary">Unknown</Text>
                    ),
                },
                {
                  title: "Time",
                  dataIndex: "time",
                  key: "time",
                  render: (text: string) => formatDateTime(text),
                },
              ]}
              rowKey={(record) => record.time + (record.user || "unknown")}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default ManageAppPage;
