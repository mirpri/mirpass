# Auth Code Flow

## Authorization Request

MirPass supports both PKCE (Proof Key for Code Exchange) and Confidential Client (Client Secret) flows.

### PKCE Flow (Recommended for Native/SPA)

Redirect user to:
```http
https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?
client_id=...
&response_type=code
...
&code_challenge=...
&code_challenge_method=S256
```

### Confidential Client Flow (Server-side Apps)

If you cannot use PKCE, you can omit `code_challenge` and instead provide `client_secret` when exchanging the code for a token.

Redirect user to:
```http
https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?
client_id=...
&response_type=code
&redirect_uri=...
&state=...
```

| Parameter             | Required/optional | Description                                     |
| --------------------- | ----------------- | ------------------------------------------------|
| client_id             | required          | The Application ID.                             |
| response_type         | required          | Must be `code`.                                 |
| redirect_uri          | required          | Where authentication responses can be sent and received by your app. |
| code_challenge        | optional          | Used to secure authorization code grants by using Proof Key for Code Exchange (PKCE). Required if client_secret is not used.|
| code_challenge_method | optional          | The method used to encode the `code_verifier`. SHOULD be `S256`.|
| state                 | recommended       | An opaque value used by the client to maintain state. |

### Token Exchange (POST)

**Endpoint:** `/oauth2/token`

**Headers:**
`Content-Type: application/json`

**Body (PKCE):**
```json
{
  "grant_type": "authorization_code",
  "client_id": "...",
  "code": "...",
  "code_verifier": "...",
  "redirect_uri": "..."
}
```

**Body (Confidential Client):**
```json
{
  "grant_type": "authorization_code",
  "client_id": "...",
  "client_secret": "...",
  "code": "...",
  "redirect_uri": "..."
}
```
*Note: `client_secret` can also be passed via HTTP Basic Auth header.*

### Node.js Example

This example demonstrates how to generate the `code_verifier`, `code_challenge`, and `state`, initiate the flow, and verify the token.

```javascript
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

const clientId = 'YOUR_CLIENT_ID';
const clientSecret = 'YOUR_CLIENT_SECRET'; // If applicable
const redirectUri = 'http://localhost:3000/callback';
const authServerUrl = 'https://mirpass-api.puppygoapp.com';

// Helper to generate random string (Use for state and code_verifier)
function generateRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, length); // return required number of characters
}

// Helper to base64url encode
function base64UrlEncode(str) {
    return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Helper to generate code_challenge from verifier
function generateCodeChallenge(verifier) {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return base64UrlEncode(hash);
}

// Store verifier in memory (In production, use a session or database tied to the state)
let sessionVerifier = '';

app.get('/login', (req, res) => {
    // 1. Generate state (Recommended length: 16)
    const state = generateRandomString(16);
    
    // 2. Generate code_verifier (Recommended length: 43)
    const verifier = generateRandomString(43);
    sessionVerifier = verifier; // Save this for the callback

    // 3. Generate code_challenge
    const challenge = generateCodeChallenge(verifier);

    const authUrl = `${authServerUrl}/oauth2/authorize?` + 
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}&` +
        `code_challenge=${challenge}&` +
        `code_challenge_method=S256`;
        
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const { code, state } = req.query;

    // Validate state here if needed

    try {
        const response = await axios.post(`${authServerUrl}/oauth2/token`, {
            client_id: clientId,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code: code,
            code_verifier: sessionVerifier // Send the original verifier
        });

        const { access_token } = response.data;
        
        // 1. Verify token
        // This endpoint returns validity, appId, and username
        const verifyResponse = await axios.post(`${authServerUrl}/token/verify`, {
            token: access_token
        });
        
        console.log('Token Info:', verifyResponse.data);

        // 2. Use token to get User Info
        // Include the token in the Authorization header: "Bearer <token>"
        const userResponse = await axios.get(`${authServerUrl}/myprofile`, {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        res.json({
            token_info: verifyResponse.data,
            user_profile: userResponse.data
        });
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        res.status(500).send('Authentication failed');
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

## Security & Implementation Details

### PKCE Parameters
- **code_verifier**: A cryptographically random string using the characters `A-Z`, `a-z`, `0-9`, and the punctuation characters `-._~` (hyphen, period, underscore, and tilde), between 43 and 128 characters long. **Recommended length: 43**.
- **code_challenge**: The Base64URL-encoded SHA256 hash of the `code_verifier`.

### State
- **state**: An opaque value used to maintain state between the request and the callback. **Recommended length: 16+ characters**.

### Using the Token
To access protected resources (like `/myprofile` or `/myusername`), include the Access Token in the **Authorization** header:

```http
Authorization: Bearer <YOUR_ACCESS_TOKEN>
```

### Verifying the Token
To validate a token and retrieve its associated `appId` and `username` server-side, use the verification endpoint:

**POST** `/token/verify`

**Body:**
```json
{
  "token": "YOUR_ACCESS_TOKEN"
}
```

**Response:**
```json
{
  "appid": "your-app-id",
  "username": "linked-username"
}
```

User will be redirected back after loging in.

### Sucess Response
```http
GET http://your-website.com/callback
code=AwABAAAAvPM1KaPlrEqdFSBzjqfTGBCmLdgfSTLEMPGYuNHSUYBrq...
&state=12345
```

### Error Response

```http
GET http://your-website.com/callback
error=access_denied
&error_description=the+user+canceled+the+authentication
```

## Request an access token with code

| Parameter     | Required/optional | Description                                                                  |
| ------------- | ----------------- | ---------------------------------------------------------------------------- |
| client_id     | required          | Your application id.                                                         |
| grant_type    | required          | Must be authorization_code for the authorization code flow.                  |
| redirect_uri  | required          | The same redirect_uri value that was used to acquire the authorization_code. |
| code          | required          | The authorization_code that you acquired in the first leg of the flow.       |
| code_verifier | recommended       | The same code_verifier that was used to obtain the authorization_code.       |

### Response

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```
