import { useState } from "react";
import { Button, Card, Form, Input, Typography, message, Space } from "antd";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const { Title, Text } = Typography;

function CreateAppPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { name: string; description: string }) => {
    setLoading(true);
    try {
      const { data } = await api.post("/apps/create", values);
      message.success("App created successfully");
      const appId = data.data.id; 
      navigate(`/manage/${appId}`);
    } catch (error: any) {
      const msg = error.response?.data?.message || "Could not create app";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
      <Card className="max-w-md w-full shadow-xl">
        <Space orientation="vertical" size={20} className="w-full">
          <div>
            <Title level={3} className="m-0">Create New App</Title>
            <Text type="secondary">Create a new application to manage credentials</Text>
          </div>
          
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="App Name"
              name="name"
              rules={[{ required: true, message: "Please input app name!" }]}
            >
              <Input placeholder="my-awesome-app" />
            </Form.Item>

            <Form.Item
              label="Description"
              name="description"
            >
              <Input.TextArea placeholder="Describe your app" />
            </Form.Item>

              <Button type="primary" htmlType="submit" loading={loading} block>
                Create App
              </Button>
           <Button type="text" onClick={() => navigate("/dashboard")} style={{marginTop: "10px"}} danger block>
            Cancel
          </Button>
          </Form>
          
        </Space>
      </Card>
  );
}

export default CreateAppPage;
