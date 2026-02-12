# Auth Code Flow

## Authorization Request

| Parameter             | Required/optional | Description                                     |
| --------------------- | ----------------- | ------------------------------------------------|
| client_id             | required          | The Application ID.                             |
| response_type         | required          | Must be `code`.                                 |
| redirect_uri          | required          | Where authentication responses can be sent and received by your app. |
| code_challenge        | required          | Used to secure authorization code grants by using Proof Key for Code Exchange (PKCE).|
| code_challenge_method | recommended       | The method used to encode the `code_verifier` for the code_challenge parameter. This SHOULD be `S256`, only use `plain` if the client can't support SHA256. If excluded, code_challenge is assumed to be plaintext.|
| state                 | recommended       | An opaque value used by the client to maintain state between the request and callback. The authorization server includes this value when redirecting the user-agent back to the client. The parameter SHOULD be used for preventing cross-site request forgery |

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
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6Ik5HVEZ2ZEstZnl0aEV1Q...",
  "token_type": "Bearer",
  "expires_in": 3599
}
```
