import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Space,
  Typography,
  message,
} from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import api from '../api/client'

const { Title, Text } = Typography

type LoginPayload = {
  username: string
  password: string
}

type LoginResponse = {
  status: number
  message?: string
  data?: {
    token?: string
  }
}

type Props = {
  onLogin: (token: string) => void
  isAuthenticated: boolean
}

function LoginPage({ onLogin, isAuthenticated }: Props) {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      message.success('Email verified. You can log in now.')
      const next = new URLSearchParams(searchParams)
      next.delete('verified')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleFinish = async (values: LoginPayload) => {
    setLoading(true)
    try {
      const { data } = await api.post<LoginResponse>('/login', values)
      const token = data?.data?.token

      if (!token) {
        throw new Error('Missing token from server response')
      }

      message.success(data?.message || 'Logged in')
      onLogin(token)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Flex align="center" justify="center" className="min-h-screen p-6">
      <Card className="max-w-[420px] w-full shadow-2xl">
        <Space direction="vertical" size="large" className="w-full">
          <Space direction="vertical" size={4}>
            <Title level={3} className="m-0">
              Mirpass Login
            </Title>
            <Text type="secondary">Login to continue to your dashboard</Text>
          </Space>

          <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: 'Please enter your username' }]}
            >
              <Input size="large" prefix={<UserOutlined />} placeholder="johndoe" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined />}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                Sign in
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary">
            New here? <Link to="/register">Create an account</Link>
          </Text>
        </Space>
      </Card>
    </Flex>
  )
}

export default LoginPage
