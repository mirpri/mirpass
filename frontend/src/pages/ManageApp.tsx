import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  UserAddOutlined,
  SettingOutlined,
  KeyOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { CopyIcon } from "lucide-react";
import api from "../api/client";
import type { APIKey, AppDetails, AppMember } from "../types";

const { Title, Text, Paragraph } = Typography;

function ManageAppPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  
  const [app, setApp] = useState<AppDetails | null>(null);

  useEffect(() => {
    if (appId) {
      loadApp();
    }
  }, [appId]);

  const loadApp = async () => {
    try {
      const { data } = await api.get<{ data: AppDetails }>(
        `/apps/details?id=${appId}`,
      );
      setApp(data.data);
    } catch (e) {
      message.error("Could not load app details");
      navigate("/dashboard");
    }
  };

  if (!app) return <div className="p-8">Loading...</div>;

  const items = [
    {
      key: 'keys',
      label: "API Keys",
      children: <KeysTab app={app} />,
    },
    {
      key: 'members',
      label: 'Members',
      children: <MembersTab app={app} />,
    },
    { // Only root can see settings? Or maybe admin too but restricted?
      // Logic inside Tab will handle restriction rendering
      key: 'settings',
      label: 'Settings',
      children: <SettingsTab app={app} onUpdate={loadApp} onDelete={() => navigate('/dashboard')} />,
    },
  ];

  return (
    <div className="min-h-screen py-8 px-6 bg-purple-60 flex items-center justify-center">
      <Card
        className="max-w-5xl w-full rounded-[18px] bg-white/95 shadow-xl p-6"
        title="Manage Application"
        extra={
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/dashboard")}
            > Back to Dashboard</Button>
        }
      >
        <Space size={10} align="center" className="mb-3">
            <Title level={3} style={{ marginBottom: 0 }}>{app.name}</Title>
            <Tag color="blue">{app.role}</Tag>
        </Space>
        <Tabs defaultActiveKey="keys" items={items} />
      </Card>
    </div>
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
      const { data } = await api.get<{ data: APIKey[] }>(`/apps/keys?id=${app.id}`);
      setKeys(data.data || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    try {
      const { data } = await api.post<{ data: { key: string } }>("/apps/keys/create", {
        appId: app.id,
        name: keyName,
      });
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
      dataIndex: "created_at",
      key: "created_at",
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          Create New Key
        </Button>
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
          <Button key="close" type="primary" onClick={() => setResultModalOpen(false)}>
            Done
          </Button>,
        ]}
      >
        <div className="flex flex-col gap-2">
            <Text type="secondary">Copy this key now. You won't see it again.</Text>
            <Space.Compact style={{ width: '100%' }}>
                <Input value={newKeyValue} readOnly />
                <Button onClick={() => {
                    navigator.clipboard.writeText(newKeyValue);
                    message.success("Copied to clipboard");
                }}>
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

  useEffect(() => {
    fetchMembers();
  }, [app.id]);

  const fetchMembers = async () => {
    if (app.role !== 'root' && app.role !== 'admin') return; 
    setLoading(true);
    try {
      const { data } = await api.get<{ data: AppMember[] }>(`/apps/members?id=${app.id}`);
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
              role
          });
          message.success("Role updated");
          fetchMembers();
      } catch(e) {
          message.error("Failed to update role");
      }
  }

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
           return <Tag color={role === 'root' ? 'gold' : 'blue'}>{role}</Tag>;
      }
    },
    {
      title: "Joined",
      dataIndex: "joined_at",
      key: "joined",
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: AppMember) => {
        if (app.role !== 'root') return null;
        if (record.role === 'root') return null; // Can't delete other roots?
        
        return (
          <Space>
             <Popconfirm title="Remove this member?" onConfirm={() => handleRemoveMember(record.username)}>
                <Button danger type="text" size="small">Remove</Button>
             </Popconfirm>
             {record.role === 'admin' && (
                 <Button size="small" type="link" onClick={() => handleUpdateRole(record.username, 'root')}>Promote to Root</Button>
             )}
          </Space>
        );
      },
    },
  ];

  if (app.role !== 'root' && app.role !== 'admin') {
      return <div className="text-gray-500">You do not have permission to view members.</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Text>Manage team members and their access levels.</Text>
        {app.role === 'root' && (
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAddModalOpen(true)}>
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
            <Input value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="Username" />
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

function SettingsTab({ app, onUpdate, onDelete }: { app: AppDetails, onUpdate: () => void, onDelete: () => void }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      name: app.name,
      description: app.description,
    });
  }, [app]);

  const handleUpdate = async (values: any) => {
    setLoading(true);
    try {
      await api.post("/apps/update", {
        appId: app.id,
        name: values.name,
        description: values.description,
      });
      message.success("App updated");
      onUpdate();
    } catch (e) {
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
  }

  const isRoot = app.role === 'root';
  const isAdmin = app.role === 'admin';

  if (!isRoot && !isAdmin) {
      return <div>You don't have permission to manage this app.</div>
  }

  return (
    <div className="max-w-2xl">
      <Title level={4}>General Settings</Title>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleUpdate}
        disabled={!isRoot && !isAdmin} // Admins can usually update details?
      >
        <Form.Item
          label="App Name"
          name="name"
          rules={[{ required: true, message: 'Please input app name!' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
        >
          <Input.TextArea rows={4} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
            Save Changes
          </Button>
        </Form.Item>
      </Form>

      {isRoot && (
        <>
          <Divider />
          <div className="border border-red-200 p-4 rounded-lg">
            <Title level={5} type="danger">Danger Zone</Title>
            <Paragraph>
              Deleting this application will remove all associated data, including API keys and member associations. This action cannot be undone.
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

export default ManageAppPage;
