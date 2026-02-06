import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Select,
  message,
  Tag,
  Space,
  Card,
} from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
    ShieldBanIcon
} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const { TextArea } = Input;

type AdminUserView = {
  username: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  role: string;
  isVerified: boolean;
};

type AppRole = {
    app: string;
    role: string;
}

function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [search, setSearch] = useState('');
  const [systemRole, setSystemRole] = useState<string>("");
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserView | null>(null);

  const [form] = Form.useForm();
  const [passForm] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
    fetchUsers();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: appsData } = await api.get<{ data: AppRole[] }>('/myapps');
      const apps = appsData.data || [];
      const sys = apps.find(a => a.app === "system");
      
      if (!sys || (sys.role !== "admin" && sys.role !== "root")) {
        message.error('Unauthorized access');
        return;
      }
      setSystemRole(sys.role);
    } catch (error) {
      message.error('Failed to authenticate');
    } finally {
        setCheckingAuth(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const endpoint = search ? `/admin/users/search?q=${search}` : '/admin/users';
      const { data } = await api.get(endpoint);
      setUsers(data.data || []);
    } catch (error) {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (username: string) => {
    Modal.confirm({
      title: 'Are you sure?',
      content: 'This action cannot be undone.',
      onOk: async () => {
        try {
          await api.post(`/admin/user/delete?username=${username}`);
          message.success('User deleted');
          fetchUsers();
        } catch (error) {
          message.error('Delete failed');
        }
      },
    });
  };

  if (checkingAuth) {
      return <div className="p-10 text-center">Loading...</div>;
  }

  const handleEdit = (user: AdminUserView) => {
    setEditingUser(user);
    form.setFieldsValue({
      email: user.email,
      nickname: user.nickname,
      role: user.role,
    });
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      
      // Update basic info
      await api.post('/admin/user/update', {
        username: editingUser?.username,
        email: values.email,
        nickname: values.nickname,
      });

      // Update role if changed and allowed
      if (systemRole === 'root' && values.role !== editingUser?.role) {
        await api.post('/root/user/role', {
          username: editingUser?.username,
          role: values.role,
        });
      }

      message.success('User updated');
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (error) {
      message.error('Update failed');
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
      await api.post('/admin/user/reset-password', {
        username: editingUser?.username,
        password: values.password,
      });
      message.success('Password reset successfully');
      setIsPasswordModalOpen(false);
    } catch (error) {
      message.error('Reset failed');
    }
  };

  const runSQL = async () => {
    try {
      const { data } = await api.post('/root/sql', { query: sqlQuery });
      setSqlResult(data.data);
      message.success('Query executed');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Query failed');
      setSqlResult(null);
    }
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'root' ? 'red' : role === 'admin' ? 'blue' : 'green'}>
          {role.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AdminUserView) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Button icon={<ReloadOutlined />} size="small" onClick={() => handlePasswordReset(record)} />
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => handleDelete(record.username)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <Card
        title={
          <Space>
            Admin Panel
          </Space>
        }
        extra={
          <Space>
             <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
             <Button type="primary" onClick={fetchUsers}>Refresh</Button>
          </Space>
        }
        className="shadow-md"
      >
         <div className="mb-4 flex gap-4">
            <Input 
                placeholder="Search users..." 
                prefix={<SearchOutlined />} 
                value={search}
                onChange={e => setSearch(e.target.value)}
                onPressEnter={fetchUsers}
                className="max-w-md"
            />
            <Button type="primary" onClick={fetchUsers}>Search</Button>
         </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="username"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />

        {systemRole === 'root' && (
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
              <Space direction="vertical" className="w-full">
                <TextArea
                  rows={4}
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM users;"
                  className="font-mono bg-gray-800 text-gray-200 border-none"
                />
                <Button type="primary" onClick={runSQL}>
                  <ShieldBanIcon size={18}/>Execute SQL
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
      </Card>

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
          {systemRole === 'root' && (
            <Form.Item name="role" label={<><ShieldBanIcon size={16}/> Role</>}>
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
            rules={[{ required: true, min: 6 }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AdminPage;
