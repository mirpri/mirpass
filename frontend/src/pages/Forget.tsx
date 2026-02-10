import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Form, Input, Space, Typography, message } from "antd";
import {
  UserOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { MailCheckIcon } from "lucide-react"
import api from "../api/client";
import { sha256 } from "../utils/crypto";

const { Title, Text } = Typography;

function ForgetPage() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (values: {
    username: string;
    newPassword: string;
  }) => {
    setLoading(true);
    try {
      await api.post("/profile/password/reset", {
        username: values.username,
        newPassword: await sha256(values.newPassword),
      });
      setSubmitted(true);
      message.success(
        "A verification email has been sent",
      );
    } catch (error: any) {
      // Always show success message for security/privacy to prevent user enumeration
      setSubmitted(true);
      message.success(
        "A verification email has been sent",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <Space orientation="vertical" size="large" className="w-full">
        {!submitted ? (
          <>
            <div className="text-center">
              <Title level={3}>Forget Password</Title>
              <Text type="secondary">
                Enter your username and new password.
              </Text>
            </div>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
            >
              <Form.Item
                name="username"
                label="Username"
                rules={[
                  { required: true, message: "Please enter your username" },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="mirpass_user"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: "Please enter a new password" },
                  {
                    min: 8,
                    message: "Password must be at least 8 characters",
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="New strong password"
                  size="large"
                />
              </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={loading}
                  style={{marginTop: "20px"}}
                >
                  Reset Password
                </Button>
            </Form>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="mb-4">
              <MailCheckIcon size={100} className="m-auto"/>
            </div>
            <Title level={4}>Check your email</Title>
            <Text className="block">
              We've sent a confirmation link to the email address associated
              with that username. Please check your inbox (and spam folder) to
              complete the reset process.
            </Text>
          </div>
        )}

        <div className="text-center">
          <Link to="/login" className="text-gray-500 hover:text-blue-500">
            <Space>
              Back to Login
            </Space>
          </Link>
        </div>
      </Space>
    </Card>
  );
}

export default ForgetPage;
