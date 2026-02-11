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
