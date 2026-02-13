
import os

file_path = "/home/mirpri/Desktop/mirpass/frontend/src/pages/ManageApp.tsx"

with open(file_path, 'r') as f:
    content = f.read()

# 1. Update items in ManageAppPage
# Search for:
#     {
#       key: "keys",
#       label: "API Keys",
#       children: <KeysTab app={app} />,
#     },
# Replace with:
#     {
#       key: "trusted_uris",
#       label: "Trusted URIs",
#       children: <TrustedUrisTab app={app} />,
#     },

old_items_code = '''    {
      key: "keys",
      label: "API Keys",
      children: <KeysTab app={app} />,
    },'''

new_items_code = '''    {
      key: "trusted_uris",
      label: "Trusted URIs",
      children: <TrustedUrisTab app={app} />,
    },'''

if old_items_code in content:
    content = content.replace(old_items_code, new_items_code)
else:
    print("Could not find items definition to update")


# 2. Add TrustedUrisTab component before StatsTab
# Find // --- Stats Tab ---
stats_tab_marker = "// --- Stats Tab ---"
start_stats = content.find(stats_tab_marker)

if start_stats == -1:
   print("Stats tab marker not found")
else:
   trusted_uris_code = '''// --- Trusted URIs Tab ---

function TrustedUrisTab({ app }: { app: AppDetails }) {
  const [uris, setUris] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newUri, setNewUri] = useState("");

  useEffect(() => {
    fetchUris();
  }, [app.id]);

  const fetchUris = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/apps/uris?id=${app.id}`);
      setUris(data.data || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUri = async () => {
    try {
      await api.post("/apps/uris/add", {
          appId: app.id,
          uri: newUri
      });
      message.success("URI added successfully");
      setCreateModalOpen(false);
      setNewUri("");
      fetchUris();
    } catch (e) {
      message.error("Failed to add URI");
    }
  };

  const handleDeleteUri = async (id: number) => {
    try {
      await api.post("/apps/uris/delete", {
        appId: app.id,
        uriId: id
      });
      message.success("URI deleted");
      fetchUris();
    } catch (e) {
      message.error("Failed to delete URI");
    }
  };

  const columns = [
    {
      title: "URI",
      dataIndex: "uri",
      key: "uri",
      render: (text: string) => <Text copyable>{text}</Text>,
    },
    {
      title: "Added At",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => <Text>{formatDateTime(date)}</Text>,
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: any) => (
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
        <Title level={4}>Trusted Redirect URIs</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          Add URI
        </Button>
      </div>

      <Alert
        message="Important Security Configuration"
        description="Only these URIs will be allowed as callback targets during OAuth flows. Wildcards are not supported."
        type="warning"
        showIcon
        className="mb-4"
      />

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
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateUri}
        okText="Add"
        confirmLoading={loading}
      >
        <Paragraph>
            Enter the full URI including scheme (http/https).
        </Paragraph>
        <Input
          placeholder="https://myapp.com/callback"
          value={newUri}
          onChange={(e) => setNewUri(e.target.value)}
        />
      </Modal>
    </div>
  );
}

'''
   content = content[:start_stats] + trusted_uris_code + "\n\n" + content[start_stats:]


# 4. Rewrite AuthCodeFlowGuide
# Find start and end of AuthCodeFlowGuide
# It starts with "function AuthCodeFlowGuide({ app }: { app: AppDetails }) {"
# It ends before "function DeviceCodeFlowGuide"

start_auth = content.find("function AuthCodeFlowGuide({ app }: { app: AppDetails }) {")
end_auth = content.find("function DeviceCodeFlowGuide")

if start_auth != -1 and end_auth != -1:
    old_auth_content = content[start_auth:end_auth]
    
    # We will replace it with the new version
    new_auth_content = '''function AuthCodeFlowGuide({ app }: { app: AppDetails }) {
  const backendUrl = config.API_URL;
  if (backendUrl.endsWith("/")) {
    backendUrl.slice(0, -1);
  }

  const [redirectUri, setRedirectUri] = useState<string>("http://localhost:3000/callback");
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
    message.info("Opens provider authorization page. After approval, copy the 'code' from the URL.");
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
        message="Recommended for Web/Mobile Apps"
        description="Authorization Code Flow with PKCE is the most secure method for authenticating users in public clients."
        type="info"
        showIcon
        className="mb-4"
      />
      
      <Space orientation="vertical" className="w-full bg-gray-50 dark:bg-gray-900/20 p-4 rounded border border-gray-200 dark:border-gray-700">
         <Title level={4}>Test Authorization Code Flow</Title>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Text strong>Client ID</Text>
              <Input value={app.id} disabled />
            </div>
            <div>
              <Text strong>Redirect URI</Text>
              <Input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
            </div>
            <div>
               <Text strong>State (Random)</Text>
               <div className="flex gap-2">
                 <Input value={state} disabled />
               </div>
            </div>
             <div>
               <Text strong>Code Verifier (PKCE)</Text>
               <div className="flex gap-2">
                 <Input value={verifier} disabled />
                 <Button icon={<ReloadOutlined />} onClick={regenerateParams} />
               </div>
            </div>
             <div className="col-span-1 md:col-span-2">
               <Text strong>Code Challenge (S256(Verifier))</Text>
               <Input value={challenge} disabled />
            </div>
         </div>
         
         <Button type="primary" onClick={handleAuthorize} disabled={!challenge} className="mt-4">
            1. Simulate Authorization Request (Opens Popup)
         </Button>
         
         <div className="mt-6">
             <Paragraph>
               2. After approval, you will be redirected to the URI above with a <code>code</code>. Paste it here:
             </Paragraph>
             <div className="flex gap-2">
                 <Input 
                    placeholder="Paste code here..." 
                    value={authCode} 
                    onChange={(e) => setAuthCode(e.target.value)} 
                  />
                 <Button type="primary" onClick={handleExchange} disabled={!authCode}>
                   Exchange Token
                 </Button>
             </div>
         </div>
         
         {tokenResult && (
             <div className="mt-2 bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200">
               <Text strong className="text-green-600">Access Token Response:</Text>
               <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm text-gray-600 dark:text-gray-300 font-mono overflow-auto">
                    {JSON.stringify(tokenResult, null, 2)}
               </div>
             </div>
         )}
      </Space>


      <div>
        <Title level={4}>1. Initiate Authorization</Title>
        <Paragraph>Redirect the user to the authorization endpoint.</Paragraph>
        <div className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
           <span className="text-purple-400">GET</span> {backendUrl}/oauth2/authorize
           <br/>?client_id={app.id}
           <br/>&response_type=code
           <br/>&redirect_uri={encodeURIComponent(redirectUri)}
           <br/>&scope=openid profile
           <br/>&state={state}
           <br/>&code_challenge={challenge}
           <br/>&code_challenge_method=S256
        </div>
      </div>

      <div>
        <Title level={4}>2. Exchange Code</Title>
        <Paragraph>Exchange the received authorization code for tokens.</Paragraph>
        <div className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
          <span className="text-purple-400">POST</span> {backendUrl}/oauth2/token
          <br />
          <span className="text-blue-300">Content-Type:</span> application/json
          <br />
          <br />
          {`{
  "grant_type": "authorization_code",
  "client_id": "${app.id}",
  "code": "${authCode || "AUTHORIZATION_CODE"}",
  "code_verifier": "${verifier}",
  "redirect_uri": "${redirectUri}"
}`}
        </div>
      </div>
    </div>
  );
}

'''
    content = content[:start_auth] + new_auth_content + content[end_auth:]

# 5. Remove KeysTab
# Find start of KeysTab
# // --- Keys Tab ---
# Ends before // --- Guide Tab ---
start_keys = content.find("// --- Keys Tab ---")
start_guide = content.find("// --- Guide Tab ---")

if start_keys != -1 and start_guide != -1:
    content = content[:start_keys] + content[start_guide:]

with open(file_path, 'w') as f:
    f.write(content)

print("Updated ManageApp.tsx")
