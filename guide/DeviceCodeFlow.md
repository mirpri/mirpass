# Device Code Flow

## Device authorization request

The client must first check with the authentication server for a device and user code used to initiate authentication. The client collects this request from the /devicecode endpoint. In the request, the client should also include the permissions it needs to acquire from the user.

From the moment the request is sent, the user has 10 minutes to sign in. This is the default value for expires_in. The request should only be made when the user indicates they're ready to sign in.

```http
// Line breaks are for legibility only.

POST https://mirpass-api.puppygoapp.com/oauth2/devicecode
Content-Type: application/x-www-form-urlencoded

client_id=00001111-aaaa-2222-bbbb-3333cccc4444
```

| Parameter | Condition | Description                                |
| --------- | --------- | ------------------------------------------ |
| client_id | Required  | The Application ID of your app at Mirpass. |

**Device authorization response**

A successful response is a JSON object containing the required information to allow the user to sign in.

|Parameter|Format|Description|
|-|-|-|
device_code|String|A long string used to verify the session between the client and the authorization server.
user_code|String|A short string shown to the user used to identify the session on a secondary device.
verification_uri|URI|The URI the user should go to with the user_code in order to sign in.
verification_uri_complete|URI|A verification URI that includes the "user_code"
interval|int|The number of seconds the client should wait between polling requests.
expires_in|int|The number of seconds before the device_code and user_code expire.


## Authenticating the user
After the client receives user_code and verification_uri, the values are displayed and the user is directed to sign in via their mobile or PC browser.

While the user is authenticating at the verification_uri, the client should be polling the /token endpoint for the requested token using the device_code.

```HTTP
POST https://mirpass-api.puppygoapp.com/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:device_code&
client_id=00001111-aaaa-2222-bbbb-3333cccc4444&
device_code=GMMhmHCXhWEzkobqIHGG_EnNYYsAkukHspeYUk9E8...
```
|Parameter|Required|Description|
|-|-|-|
grant_type|Required|Must be urn:ietf:params:oauth:grant-type:device_code
client_id|Required|Must match the client_id used in the initial request.
device_code|Required|The device_code returned in the device authorization request.

**Expected errors**

The device code flow is a polling protocol so errors served to the client must be expected prior to completion of user authentication.

|Error|Description|Client Action
|-|-|-|
|authorization_pending|The user hasn't finished authenticating, but hasn't canceled the flow.|Repeat the request after at least interval seconds.
slow_down|A variant of "authorization_pending"|Increase polling interval
access_denied|The authorization request was denied.|Stop polling and revert to an unauthenticated state.
expired_token|Value of expires_in has been exceeded and authentication is no longer possible with device_code.|Stop polling and revert to an unauthenticated state.

Successful authentication response
A successful token response looks like:

```JSON
{
"token_type": "Bearer",
"expires_in": 3599,
"access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJhdWQiOiIyZDRkMTFhMi1mODE0LTQ2YTctOD..."
}
```
|Parameter|Format|Description|
|-|-|-|
token_type|String|Always Bearer.
expires_in|int|Number of seconds the access token is valid for.
access_token|JWT|The issued token.

### Node.js Example

```javascript
const axios = require('axios');

const clientId = 'YOUR_CLIENT_ID';
const authServerUrl = 'https://mirpass-api.puppygoapp.com';

async function deviceFlow() {
    try {
        // Step 1: Request Device Code
        const deviceResponse = await axios.post(`${authServerUrl}/oauth2/devicecode`, new URLSearchParams({
            client_id: clientId
        }));

        const { device_code, user_code, verification_uri, interval, expires_in } = deviceResponse.data;

        console.log(`Please visit ${verification_uri} and enter code: ${user_code}`);

        // Step 2: Poll for Token
        const pollInterval = interval * 1000;
        const endTime = Date.now() + expires_in * 1000;

        while (Date.now() < endTime) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            try {
                const tokenResponse = await axios.post(`${authServerUrl}/oauth2/token`, new URLSearchParams({
                    client_id: clientId,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                    device_code: device_code
                }));

                const { access_token } = tokenResponse.data;
                console.log('Access Token:', access_token);

                // 1. Verify token
                // This endpoint returns validity, appId, and username
                const verifyResponse = await axios.post(`${authServerUrl}/token/verify`, {
                    token: access_token
                });
                
                console.log('Token Info:', verifyResponse.data);

                // 2. Use token to get User Info
                const userResponse = await axios.get(`${authServerUrl}/userinfo`, {
                    headers: { Authorization: `Bearer ${access_token}` }
                });

                console.log('User Profile:', userResponse.data);
                return;
            } catch (error) {
                if (error.response && error.response.data.error === 'authorization_pending') {
                    console.log('Waiting for user authorization...');
                } else {
                    throw error;
                }
            }
        }
        console.log('Device code expired');

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

deviceFlow();
```

## Implementation Details

### Using the Token
To access protected resources (like `/userinfo`), include the Access Token in the **Authorization** header:

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
