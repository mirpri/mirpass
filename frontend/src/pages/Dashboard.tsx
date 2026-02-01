import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Row,
  Space,
  Typography,
  message,
} from 'antd'
import { LogoutOutlined, MailOutlined, UserOutlined, KeyOutlined } from '@ant-design/icons'
import api from '../api/client'

const { Title, Text } = Typography

type SimpleResponse = {
  status: number
  message?: string
}

type Props = {
  onLogout: () => void
}

function DashboardPage({ onLogout }: Props) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const tokenPreview = useMemo(() => {
    const token = localStorage.getItem('token') || ''
    if (token.length <= 12) return token
    return `${token.slice(0, 12)}...`
  }, [])

  const handleNickname = async (values: { nickname: string }) => {
    setLoadingKey('nickname')
    try {
      const { data } = await api.post<SimpleResponse>('/profile/nickname', values)
      message.success(data?.message || 'Nickname updated')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message || 'Could not update nickname')
    } finally {
      setLoadingKey(null)
    }
  }

  const handleEmail = async (values: { email: string }) => {
    setLoadingKey('email')
    try {
      const { data } = await api.post<SimpleResponse>('/profile/email', values)
      message.success(data?.message || 'Email updated')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message || 'Could not update email')
    } finally {
      setLoadingKey(null)
    }
  }

  const handlePassword = async (values: { currentPassword: string; newPassword: string }) => {
    setLoadingKey('password')
    try {
      const { data } = await api.post<SimpleResponse>('/profile/password', values)
      message.success(data?.message || 'Password updated')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message || 'Could not update password')
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', background: 'linear-gradient(135deg, #f4f0ff 0%, #f8fbff 60%, #eef2ff 100%)' }}>
      <Card
        style={{ maxWidth: 1100, margin: '0 auto', borderRadius: 18, boxShadow: '0 25px 80px rgba(76, 29, 149, 0.15)' }}
        bodyStyle={{ padding: '28px 28px 32px' }}
      >
        <Flex justify="space-between" align="center" wrap>
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              Dashboard
            </Title>
            <Text type="secondary">Manage your profile and credentials</Text>
            {tokenPreview && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Token stored locally: {tokenPreview}
              </Text>
            )}
          </Space>
          <Button icon={<LogoutOutlined />} onClick={onLogout}>
            Logout
          </Button>
        </Flex>

        <div style={{ marginTop: 24 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="Update nickname" bordered={false}>
                <Form layout="vertical" onFinish={handleNickname} requiredMark={false}>
                  <Form.Item
                    label="New nickname"
                    name="nickname"
                    rules={[{ required: true, message: 'Please enter a nickname' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="Your display name" />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loadingKey === 'nickname'}
                      block
                    >
                      Save nickname
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card title="Change email" bordered={false}>
                <Form layout="vertical" onFinish={handleEmail} requiredMark={false}>
                  <Form.Item
                    label="New email"
                    name="email"
                    rules={[{ required: true, message: 'Please enter a valid email', type: 'email' }]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="name@example.com" />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loadingKey === 'email'}
                      block
                    >
                      Save email
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card title="Change password" bordered={false}>
                <Form layout="vertical" onFinish={handlePassword} requiredMark={false}>
                  <Form.Item
                    label="Current password"
                    name="currentPassword"
                    rules={[{ required: true, message: 'Please enter your current password' }]}
                  >
                    <Input.Password prefix={<KeyOutlined />} placeholder="Current password" />
                  </Form.Item>
                  <Form.Item
                    label="New password"
                    name="newPassword"
                    rules={[{ required: true, message: 'Please enter a new password' }]}
                  >
                    <Input.Password prefix={<KeyOutlined />} placeholder="New password" />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loadingKey === 'password'}
                      block
                    >
                      Update password
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>
        </div>
      </Card>
    </div>
  )
}

export default DashboardPage
