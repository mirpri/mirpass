import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { ErrorResponse } from "../types";
import {
  Button,
  Card,
  Table,
  Typography,
  App,
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
  ReloadOutlined,
} from "@ant-design/icons";
import { BanIcon } from "lucide-react";
import ImgCrop from "antd-img-crop";

import dayjs from "dayjs";
import { formatDateTime, toUtcDateString } from "../utils/date";
import { sha256, generateRandomString } from "../utils/crypto";

import api from "../api/client";
import { config } from "../config";
import type {
  AppDetails,
  AppMember,
  LoginHistoryItem,
  AppStatsSummary,
  TrustedUri,
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
      App.useApp().message.error("Could not load app details");
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
      key: "trusted_uris",
      label: "Trusted URIs",
      children: <TrustedUrisTab app={app} />,
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
        <AnyAvatar size={48} url={{ url: app.logoUrl, text: app.name }} />
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

// --- Trusted URIs Tab ---

function TrustedUrisTab({ app }: { app: AppDetails }) {
  const { message } = App.useApp();
  const [uris, setUris] = useState<TrustedUri[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUri, setNewUri] = useState("");

  useEffect(() => {
    fetchUris();
  }, [app.id]);

  const fetchUris = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: TrustedUri[] }>(
        `/apps/uris?id=${app.id}`,
      );
      setUris(data.data || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUri = async () => {
    const trimmed = newUri.trim();
    if (!trimmed) {
      message.error("URI is required");
      return;
    }

    try {
      await api.post("/apps/uris/add", {
        appId: app.id,
        name: newName.trim(),
        uri: trimmed,
      });
      message.success("Trusted URI added");
      setCreateModalOpen(false);
      setNewName("");
      setNewUri("");
      fetchUris();
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to add trusted URI";
      message.error(msg);
    }
  };

  const handleDeleteUri = async (uriId: number) => {
    try {
      await api.post("/apps/uris/delete", { appId: app.id, uriId });
      message.success("Trusted URI removed");
      fetchUris();
    } catch (e: any) {
      const msg =
        e.response?.data?.message || "Failed to remove trusted URI";
      message.error(msg);
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text?: string) => text || <Text type="secondary">Unnamed</Text>,
    },
    {
      title: "URI",
      dataIndex: "uri",
      key: "uri",
      render: (text: string) => <Text copyable>{text}</Text>,
    },
    {
      title: "Added At",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (text: string) => formatDateTime(text),
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: TrustedUri) => (
        <Popconfirm
          title="Delete this URI?"
          onConfirm={() => handleDeleteUri(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Text>Manage redirect URIs allowed by Authorization Code flow.</Text>
        {app.role !== "external" && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add URI
          </Button>
        )}
      </div>

      <Table
        dataSource={uris}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="Add Trusted URI"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          setNewName("");
          setNewUri("");
        }}
        onOk={handleCreateUri}
        okText="Add"
      >
        <Form layout="vertical">
          <Form.Item label="Name">
            <Input
              placeholder="e.g. Local dev callback"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="URI" required>
            <Input
              placeholder="https://example.com/callback"
              value={newUri}
              onChange={(e) => setNewUri(e.target.value)}
            />
          </Form.Item>
        </Form>
        <Paragraph>
          Enter full URI including scheme. Wildcards(*) are not allowed.
        </Paragraph>
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
  const { message } = App.useApp();
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
  const { message } = App.useApp();
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
      const err = e as ErrorResponse;
      console.error("Failed to update app", err.response);

      message.error(err.response?.data?.error || "Failed to update app");
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
  const items = [
    {
      key: "authcode",
      label: "Authorization Code Flow (Recommended)",
      children: <AuthCodeFlowGuide app={app} />,
    },
    {
      key: "device",
      label: "Device Code Flow",
      children: <DeviceCodeFlowGuide app={app} />,
    },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Title level={3}>Integration Guide</Title>
        <Paragraph>
          Select the authentication flow that best suits your application.
        </Paragraph>
        <Tabs items={items} />
      </div>
    </div>
  );
}

function AuthCodeFlowGuide({ app }: { app: AppDetails }) {
  let backendUrl = config.API_URL;
  if (backendUrl.endsWith("/")) {
    backendUrl = backendUrl.slice(0, -1);
  }
  
  const { message } = App.useApp();
  const [redirectUri, setRedirectUri] = useState<string>(
    "",
  );
  const [state, setState] = useState<string>(generateRandomString(16));
  const [verifier, setVerifier] = useState<string>(generateRandomString(43));
  const [challenge, setChallenge] = useState<string>("");

  const [authCode, setAuthCode] = useState<string>("");
  const [tokenResult, setTokenResult] = useState<any>(null);

  useEffect(() => {
    sha256(verifier).then(setChallenge);
  }, [verifier]);

  const regenerateParams = () => {
    const v = generateRandomString(43);
    setVerifier(v);
    setState(generateRandomString(16));
  };

  const handleAuthorize = () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: app.id,
      redirect_uri: redirectUri,
      state: state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    const url = `${config.API_URL}/oauth2/authorize?${params.toString()}`;
    window.open(url, "_blank");
    message.info(
      "Opens provider authorization page. After approval, copy the 'code' from the URL.",
    );
  };

  const handleExchange = async () => {
    if (!authCode) {
      message.error("Please enter the authorization code");
      return;
    }
    try {
      const { data } = await api.post("/oauth2/token", {
        grant_type: "authorization_code",
        client_id: app.id,
        code: authCode,
        code_verifier: verifier,
      });
      setTokenResult(data);
      message.success("Token exchanged successfully!");
    } catch (error: any) {
      const msg = error.response?.data?.error || "Failed to exchange token";
      message.error(msg);
      setTokenResult({ error: msg });
    }
  };

  return (
    <div className="space-y-6">
      <Alert
        title="Recommended for Web / Mobile Apps"
        description="Authorization Code Flow with PKCE is the most secure method for authenticating users in public clients. Use this as long as your app can securely handle redirects."
        type="info"
        showIcon
      />

      <Space
        direction="vertical"
        className="w-full bg-gray-50 dark:bg-gray-900/20 p-4 rounded border border-gray-200 dark:border-gray-700 mt-4"
      >
        <Title level={4}>Test Authorization Code Flow</Title>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Text strong>Client ID</Text>
            <Input value={app.id} disabled />
          </div>
          <div>
            <Text strong>Redirect URI</Text>
            <Input
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
            />
          </div>
          <div>
            <Text strong>State (Random)</Text>
            <Input value={state} disabled />
          </div>
          <div>
            <Text strong>Code Verifier (PKCE)</Text>
            <Space.Compact style={{ width: "100%" }}>
              <Input value={verifier} disabled />
              <Button icon={<ReloadOutlined />} onClick={regenerateParams} />
            </Space.Compact>
          </div>
          <div className="col-span-1 md:col-span-2">
            <Text strong>Code Challenge (S256(Verifier))</Text>
            <Input value={challenge} disabled />
          </div>
        </div>

        <Button type="primary" onClick={handleAuthorize} disabled={!challenge}>
          Simulate authorization request
        </Button>

        <Paragraph className="mb-0">
          After approval, copy the <code>code</code> query value from your
          redirect URI.
        </Paragraph>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            placeholder="Paste authorization code here..."
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
          />
          <Button type="primary" onClick={handleExchange} disabled={!authCode}>
            Exchange token
          </Button>
        </Space.Compact>

        {tokenResult && (
          <div className="mt-2 bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200">
            <Text strong className="text-green-600">
              Token Response:
            </Text>
            <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm text-gray-600 dark:text-gray-300 font-mono overflow-x-auto">
              {JSON.stringify(tokenResult, null, 2)}
            </div>
          </div>
        )}
      </Space>

      <div>
        <Title level={4}>1. Initiate Authorization</Title>
        <Paragraph>Send the user to the authorization endpoint.</Paragraph>
        <div className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
          <span className="text-purple-400">GET</span> {backendUrl}
          /oauth2/authorize
          <br />
          ?client_id={app.id}
          <br />
          &response_type=code
          <br />
          &redirect_uri={encodeURIComponent(redirectUri)}
          <br />
          &state={state}
          <br />
          &code_challenge={challenge}
          <br />
          &code_challenge_method=S256
        </div>
      </div>
      <Alert
        title={"The redirected_uri must match one of the app's registered trusted URIs."}
        type="warning"
        showIcon
      />

      <div className="mt-6">
        <Title level={4}>2. Exchange Code for Token</Title>
        <Paragraph>Exchange the received code for tokens.</Paragraph>
        <div className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
          <span className="text-purple-400">POST</span> {backendUrl}
          /oauth2/token
          <br />
          <span className="text-blue-300">Content-Type:</span> application/json
          <br />
          <br />
          {`{
  "grant_type": "authorization_code",
  "client_id": "${app.id}",
  "code": "${authCode || "AUTHORIZATION_CODE"}",
  "code_verifier": "${verifier}"
}`}
        </div>
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
  );
}

function DeviceCodeFlowGuide({ app }: { app: AppDetails }) {
  const { message } = App.useApp();
  let backendUrl = config.API_URL;
  if (backendUrl.endsWith("/")) {
    backendUrl = backendUrl.slice(0, -1);
  }
  const frontendUrl = window.location.origin;

  const [deviceCodeData, setDeviceCodeData] = useState<any>(null);
  const [pollStatus, setPollStatus] = useState<string>("");
  const [pollResult, setPollResult] = useState<any>(null);

  const handleCreateTestSession = async () => {
    setDeviceCodeData(null);
    setPollResult(null);
    setPollStatus("Initiating...");
    try {
      // Use Device Code Flow
      const { data } = await api.post("/oauth2/devicecode", {
        client_id: app.id,
      });

      setDeviceCodeData(data);
      setPollStatus("Waiting for user authorization...");

      message.success("Session initiated");
      // if (loginUrl) {
      //   window.open(loginUrl, "_blank");
      // }
    } catch (error: unknown) {
      const err = error as ErrorResponse;
      const msg = err.response?.data?.error || "Failed";
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
        <Alert
          message="Suitable for CLI / Limited Input Devices"
          description="Device Flow allows users to sign in on a secondary device using a short code or link. Only use this if your app cannot securely handle redirects or has limited input capabilities."
          type="info"
          showIcon
        />
        <Space
          orientation="vertical"
          className="w-full bg-gray-50 dark:bg-gray-900/20 p-4 rounded border border-gray-200 dark:border-gray-700 mt-4"
        >
          <Title level={4}>Test Device Code Flow</Title>
          <Button onClick={handleCreateTestSession} type="primary">
            Create test session
          </Button>
          {pollStatus && (
            <div className="mt-4">
              <Text strong>Status: </Text> <Text>{pollStatus}</Text>
            </div>
          )}
          {deviceCodeData && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900">
              <Paragraph className="mb-1">
                User Code:{" "}
                <Text copyable strong code>
                  {deviceCodeData.user_code}
                </Text>
              </Paragraph>
              <Paragraph className="mb-0">
                Input the above code at:{" "}
                <a
                  href={deviceCodeData.verification_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {deviceCodeData.verification_uri}
                </a>
              </Paragraph>
              <Paragraph className="mb-0">
                Or visit:{" "}
                <a
                  href={deviceCodeData.verification_uri_complete}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {deviceCodeData.verification_uri_complete}
                </a>
              </Paragraph>
            </div>
          )}
          {pollResult && (
            <div className="mt-2 bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200">
              <Text strong className="text-green-600">
                Access Token:
              </Text>
              <Paragraph className="break-all font-mono text-xs">
                {pollResult.access_token}
              </Paragraph>
              {pollResult.refresh_token && (
                <>
                  <Text strong className="text-green-600">
                    Refresh Token:
                  </Text>
                  <Paragraph className="break-all font-mono text-xs">
                    {pollResult.refresh_token}
                  </Paragraph>
                </>
              )}
            </div>
          )}
        </Space>
      </div>

      <div>
        <Title level={4}>1. Initiate Device Code Flow</Title>
        <Paragraph>Make a POST request to initiate the flow.</Paragraph>
        <div className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
          <span className="text-purple-400">POST</span> {backendUrl}
          /oauth2/devicecode
          <br />
          <span className="text-blue-300">Content-Type:</span> application/json
          <br />
          <br />
          {`{ "client_id": "${app.id}" }`}
        </div>
        <Paragraph className="mt-2 text-sm text-gray-500">Response:</Paragraph>
        <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm text-gray-600 dark:text-gray-300 font-mono">
          {`{
  "device_code": "...",
  "user_code": "WDJBMJHT",
  "verification_uri": "${frontendUrl}/auth",
  "verification_uri_complete": "${frontendUrl}/auth?user_code=WDJBMJHT",
  "expires_in": 900,
  "interval": 5
}`}
        </div>
      </div>

      <div>
        <Title level={4}>2. Poll for Token</Title>
        <Paragraph>
          Poll the token endpoint using the `device_code` until the user
          authorizes.
        </Paragraph>
        <div className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
          <span className="text-purple-400">POST</span> {backendUrl}
          /oauth2/token
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
          <Card
            title="Traffic"
            style={{ margin: "10px 0" }}
            extra={<Text type="secondary">Days split by UTC</Text>}
          >
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
