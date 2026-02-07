import { Card, Typography, Space, Button, Divider } from 'antd';
import { GithubOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { BookPlusIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <Card className="max-w-3xl w-full rounded-2xl shadow-xl">
        <Space direction="vertical" size="large" className="w-full">
            <div className='flex items-center justify-between'>
                 <Title level={2} style={{ margin: 0 }}>About Mirpass</Title>
                 <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
            </div>
         
          <Paragraph className="text-lg text-gray-600 dark:text-gray-300">
            Mirpass is a lightweight Single Sign-On (SSO) solution designed for developers and small to medium-sized organizations. It provides a secure and centralized way to manage user identities across multiple applications.
          </Paragraph>

          <Divider />

          <Space direction="vertical" size="middle">
            <Title level={4}>Why Mirpass?</Title>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300">
              <li><Text strong>Centralized Identity:</Text> Manage users in one place and let them log in to all your apps with a single account.</li>
              <li><Text strong>Developer Friendly:</Text> Simple REST API for integrating SSO into your applications in minutes.</li>
              <li><Text strong>Privacy Focused:</Text> Your data is safe. We do not track user activity or sell data to third parties.</li>
              <li><Text strong>Secure:</Text> Built with security best practices, including robust session management and token verification.</li>
            </ul>
          </Space>

          <Divider />
        
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
            <Button type="primary" size="large" icon={<GithubOutlined />} href="https://github.com/mirpass/mirpass" target="_blank">
              GitHub Repository
            </Button>
            <Button size="large" href='/apps/create'>
                <BookPlusIcon size={18} />
              Create Your App
            </Button>
          </div>
          
          <div className="text-center mt-8 text-gray-400 text-sm">
            v0.1.0-beta • Licensed under MIT
          </div>
        </Space>
      </Card>
    </div>
  );
}
