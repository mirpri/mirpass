import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Input,
  Form,
  Select,
  Tag,
  Space,
  Card,
  Tabs,
  DatePicker,
  Upload,
  App,
  Modal,
} from "antd";
import dayjs from "dayjs";
import { parseDate } from "../utils/date";
import {
  ArrowLeftOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  ShieldBanIcon,
  KeyRound,
  EditIcon,
  TrashIcon,
  CircleAlert,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AppRole, ErrorResponse } from "../types";
import api from "../api/client";
import { sha256 } from "../utils/crypto";
import { LoadingView } from "../components/LoadingView";
import { AnyAvatar } from "../components/Avatars";

const { TextArea } = Input;

type AdminAppView = {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  suspendUntil?: string | null; // Allow null
  created_at: string;
};

type AdminUserView = {
  username: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  role: string;
  isVerified: boolean;
};

// ... User Admin Logic ...
function UserTab({ systemRole }: { systemRole: string }) {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [search, setSearch] = useState("");

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserView | null>(null);

  const [form] = Form.useForm();
  const [passForm] = Form.useForm();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const endpoint = search
        ? `/admin/users/search?q=${search}`
        : "/admin/users";
      const { data } = await api.get(endpoint);
      setUsers(data.data || []);
    } catch (error) {
      message.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (username: string) => {
    modal.confirm({
      title: "Are you sure?",
      content: "This action cannot be undone.",
      onOk: async () => {
        try {
          await api.post(`/admin/user/delete?username=${username}`);
          message.success("User deleted");
          fetchUsers();
        } catch (error) {
          message.error("Delete failed");
        }
      },
    });
  };

  const handleEdit = (user: AdminUserView) => {
    setEditingUser(user);
    form.setFieldsValue({
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      role: user.role,
    });
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      await api.post("/admin/user/update", {
        username: editingUser?.username,
        email: values.email,
        nickname: values.nickname,
        avatarUrl: values.avatarUrl,
      });
      if (systemRole === "root" && values.role !== editingUser?.role) {
        await api.post("/root/user/role", {
          username: editingUser?.username,
          role: values.role,
        });
      }
      message.success("User updated");
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (error) {
      message.error("Update failed");
    }
  };

  const handlePasswordReset = (user: AdminUserView) => {
    setEditingUser(user);
    passForm.resetFields();
    setIsPasswordModalOpen(true);
  };

  const savePassword = async () => {
    try {
      const values = await passForm.validateFields();
      await api.post("/admin/user/reset-password", {
        username: editingUser?.username,
        password: await sha256(values.password),
      });
      message.success("Password reset");
      setIsPasswordModalOpen(false);
    } catch (error) {
      message.error("Reset failed");
    }
  };

  const handleVerify = async (user: AdminUserView) => {
    try {
      await api.post("/admin/user/verify", { username: user.username });
      message.success("User verified");
      fetchUsers();
    } catch (error) {
      message.error("Verification failed");
    }
  };

  const columns = [
    {
      title: "Username",
      dataIndex: "username",
      key: "username",
      render: (_: any, record: AdminUserView) => (
        <Space>
          {record.username}
          {!record.isVerified && (
            <span title="Unverified">
              <CircleAlert size={16} color="orange" />
            </span>
          )}
        </Space>
      ),
    },
    { title: "Email", dataIndex: "email", key: "email" },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag
          color={role === "root" ? "red" : role === "admin" ? "blue" : "green"}
        >
          {role.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: AdminUserView) => (
        <Space>
          <Button
            icon={<EditIcon size={14} />}
            size="small"
            onClick={() => handleEdit(record)}
            title="Edit Profile"
          />
          <Button
            icon={<KeyRound size={14} />}
            size="small"
            onClick={() => handlePasswordReset(record)}
            title="Reset Password"
          />
          <Button
            danger
            icon={<TrashIcon size={14} />}
            size="small"
            onClick={() => handleDelete(record.username)}
            title="Delete User"
          />
          {!record.isVerified && (
            <Button
              icon={<Check size={14} />}
              size="small"
              onClick={() => handleVerify(record)}
              title="Verify User"
              type="primary"
              ghost
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space.Compact className="w-full mb-5">
        <Input
          placeholder="Search users..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={fetchUsers}
          className="max-w-md"
        />
        <Button type="primary" onClick={fetchUsers}>
          Search
        </Button>
      </Space.Compact>
      <Table
        columns={columns}
        dataSource={users}
        rowKey="username"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="Edit User"
        open={isEditModalOpen}
        onOk={saveEdit}
        onCancel={() => setIsEditModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="nickname" label="Nickname">
            <Input />
          </Form.Item>
          <Form.Item name="avatarUrl" label="Avatar URL">
            <Input />
          </Form.Item>
          {systemRole === "root" && (
            <Form.Item
              name="role"
              label={
                <>
                  <ShieldBanIcon size={16} /> Role
                </>
              }
            >
              <Select>
                <Select.Option value="user">User</Select.Option>
                <Select.Option value="admin">Admin</Select.Option>
                <Select.Option value="root">Root</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="Reset Password"
        open={isPasswordModalOpen}
        onOk={savePassword}
        onCancel={() => setIsPasswordModalOpen(false)}
      >
        <Form form={passForm} layout="vertical">
          <Form.Item
            name="password"
            label="New Password"
            rules={[{ required: true}]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ... Apps Admin Logic ...
function AppsTab({ systemRole: _systemRole }: { systemRole: string }) {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<AdminAppView[]>([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const endpoint = search ? `/admin/apps?q=${search}` : "/admin/apps";
      const { data } = await api.get(endpoint);
      setApps(data.data || []);
    } catch (error) {
      message.error("Failed to fetch apps");
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (appId: string, date: dayjs.Dayjs | null) => {
    try {
      await api.post("/admin/app/suspend", {
        appId,
        suspendUntil: date ? date.toISOString() : null,
      });
      message.success("Suspension updated");
      fetchApps();
    } catch (error) {
      message.error("Failed to update suspension");
    }
  };

  const handleDelete = async (appId: string) => {
    modal.confirm({
      title: "Delete App?",
      content:
        "This will delete the app and all associated data permanently. Cannot be undone.",
      okType: "danger",
      onOk: async () => {
        try {
          await api.post(`/admin/app/delete?id=${appId}`);
          message.success("App deleted");
          fetchApps();
        } catch (error) {
          message.error("Delete failed");
        }
      },
    });
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: AdminAppView) => (
        <Space>
          <AnyAvatar url={{url: record.logoUrl, text: text}} size={"small"} />
          {text}
        </Space>
      ),
    },
    { title: "ID", dataIndex: "id", key: "id", ellipsis: true },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Suspension",
      dataIndex: "suspendUntil",
      key: "suspendUntil",
      render: (date: string | null, record: AdminAppView) => (
        <DatePicker
          size="small"
          showTime
          value={date ? parseDate(date) : null}
          onChange={(d) => handleSuspend(record.id, d)}
          allowClear
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: AdminAppView) => (
        <Space>
          <Button
            icon={<EditIcon size={14} />}
            size="small"
            onClick={() => navigate(`/manage/${record.id}`)}
            title="Edit App"
          />
          <Button
            danger
            icon={<TrashIcon size={14} />}
            size="small"
            onClick={() => handleDelete(record.id)}
            title="Delete App"
          />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space.Compact className="w-full mb-5">
        <Input
          placeholder="Search apps..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={fetchApps}
          className="max-w-md"
        />
        <Button type="primary" onClick={fetchApps}>
          Search
        </Button>
      </Space.Compact>
      <Table
        columns={columns}
        dataSource={apps}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </>
  );
}

function BlobsTab() {
  const { message } = App.useApp();
  const [blobs, setBlobs] = useState<
    { ID: string; Size: number; ContentType: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBlobs();
  }, []);

  const fetchBlobs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/blobs");
      setBlobs(data.data || []);
    } catch {
      message.error("Failed to load blobs");
    } finally {
      setLoading(false);
    }
  };

  const deleteBlob = async (id: string) => {
    try {
      await api.post("/admin/blob/delete", { id });
      message.success("Deleted");
      fetchBlobs();
    } catch {
      message.error("Delete failed");
    }
  };

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/admin/blob/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      message.success("Uploaded");
      onSuccess("ok");
      fetchBlobs();
    } catch (err) {
      onError(err);
      message.error("Upload failed");
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Upload customRequest={handleUpload} showUploadList={false}>
          <Button icon={<UploadOutlined />}>Upload Blob</Button>
        </Upload>
      </div>
      <Table
        dataSource={blobs}
        rowKey="ID"
        loading={loading}
        columns={[
          {
            title: "ID",
            dataIndex: "ID",
            render: (id) => (
              <a
                href={`${api.defaults.baseURL || ""}/blob/${id}`}
                target="_blank"
                rel="noreferrer"
              >
                {id}
              </a>
            ),
          },
          {
            title: "Size",
            dataIndex: "Size",
            render: (s) => (s / 1024).toFixed(1) + " KB",
          },
          { title: "Type", dataIndex: "ContentType" },
          {
            title: "Action",
            render: (_, r) => (
              <Button
                danger
                size="small"
                onClick={() => deleteBlob(r.ID)}
                icon={<TrashIcon size={14} />}
              ></Button>
            ),
          },
        ]}
      />
    </div>
  );
}

function AdminPage() {
  const { message } = App.useApp();
  const [systemRole, setSystemRole] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlResult, setSqlResult] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: appsData } = await api.get<{ data: AppRole[] }>("/myapps");
      const apps = appsData.data || [];
      const sys = apps.find((a) => a.name === "system");

      if (!sys || (sys.role !== "admin" && sys.role !== "root")) {
        message.error("Unauthorized access");
        navigate("/dashboard");
        return;
      }
      setSystemRole(sys.role);
    } catch (error: any) {
      const err = error as ErrorResponse;
      message.error(err.response?.data?.error || "Failed to authenticate");
    } finally {
      setCheckingAuth(false);
    }
  };

  if (checkingAuth) {
    return <LoadingView />;
  }  

  const runSQL = async () => {
    try {
      const { data } = await api.post("/root/sql", { query: sqlQuery });
      setSqlResult(data.data);
      message.success("Query executed");
    } catch (error: any) {
      const err = error as ErrorResponse;
      message.error(err.response?.data?.error || "Query failed");
      setSqlResult(null);
    }
  };

  const items = [
    {
      key: "1",
      label: "Users",
      children: <UserTab systemRole={systemRole} />,
    },
    {
      key: "2",
      label: "Applications",
      children: <AppsTab systemRole={systemRole} />,
    },
    {
      key: "3",
      label: "Blobs",
      children: <BlobsTab />,
    },
  ];

  return (
    <Card
      title="System Management"
      className="shadow-xl w-full max-w-4xl"
      extra={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Back
        </Button>
      }
    >
      <Space orientation="vertical" className="w-full">
        <Tabs defaultActiveKey="1" items={items} />
        {systemRole === "root" && (
          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700 mt-8">
            <Space orientation="vertical" className="w-full">
              <TextArea
                rows={4}
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="SELECT * FROM users;"
                className="font-mono border-none"
              />
              <Button type="primary" onClick={runSQL}>
                <ShieldBanIcon size={18} />
                Execute SQL
              </Button>
              {sqlResult && (
                <div className="overflow-x-auto p-2 rounded-lg mt-2 border border-gray-200">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(sqlResult, null, 2)}
                  </pre>
                </div>
              )}
            </Space>
          </div>
        )}
      </Space>
    </Card>
  );
}

export default AdminPage;
