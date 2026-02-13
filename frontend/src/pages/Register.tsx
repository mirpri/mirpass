import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Form,
  Input,
  Space,
  Typography,
  message,
} from 'antd'
import { MailOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import api from '../api/client'
import { sha256 } from '../utils/crypto'
import type { ErrorResponse } from '../types'

const { Title, Text } = Typography

type RegisterPayload = {
  username: string
  email: string
  password: string
}

type RegisterResponse = {
  status: number
  message?: string
}

function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleFinish = async (values: RegisterPayload & { confirm: string }) => {
    setLoading(true)
    try {
      const payload: RegisterPayload = {
        username: values.username,
        email: values.email,
        password: await sha256(values.password),
      }

      const { data } = await api.post<RegisterResponse>('/register', payload)
      message.success(data?.message || 'Registration successful. Please verify your email.')
      navigate('/login', { replace: true })
    } catch (error: unknown) {
      const err = error as ErrorResponse
      message.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
      <Card className="max-w-md w-full shadow-2xl">
        <Space orientation="vertical" size="large" className="w-full">
          <Space orientation="vertical" size={4}>
            <Title level={3} className="m-0">
              Create your account
            </Title>
            <Text type="secondary">Register to start using the dashboard</Text>
          </Space>

          <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: 'Please enter a username' },
              { min: 5, message: 'Username must be at least 5 characters' },
              { max: 15, message: 'Username cannot exceed 15 characters' },
              { pattern: /^[a-z0-9_]+$/, message: 'Can only contain lowercase letters, numbers, and underscores' }
              ]}
            >
              <Input size="large" prefix={<UserOutlined />} placeholder="johndoe" />
            </Form.Item>

            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, message: 'Please enter a valid email', type: 'email' }]}
            >
              <Input size="large" prefix={<MailOutlined />} placeholder="name@example.com" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Please enter a password' },
              { min: 8, message: 'Password must be at least 8 characters' }
              ]}
            >
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••" />
            </Form.Item>

            <Form.Item
              label="Confirm password"
              name="confirm"
              dependencies={["password"]}
              rules={[
                { required: true, message: 'Please confirm your password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Passwords do not match'))
                  },
                }),
              ]}
            >
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                Create account
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary">
            Already have an account? <Link to="/login">Sign in</Link>
          </Text>
        </Space>
      </Card>
  )
}

export default RegisterPage
