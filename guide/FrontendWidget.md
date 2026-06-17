# Frontend Widget Integration Guide

The MirPass Frontend Widget provides a simple, drop-in authentication solution for your web applications. It automates the OAuth 2.0 Authorization Code Flow with PKCE, making it incredibly easy to add secure authentication without writing complex Javascript logic.

## Overview

The widget automatically:
- Generates and manages state and PKCE code challenges
- Redirects users to the MirPass authorization server
- Handles the OAuth 2.0 callback and exchanges the authorization code for tokens
- Fetches user profile information
- Persists user sessions across page reloads using browser storage
- Provides an elegant UI out of the box (Login button or User Profile dropdown)

## Integration Steps

To add the MirPass widget to your web app, simply include the script and a target `<div>` container in your HTML.

### 1. Include the Script

Place the following `<script>` tag in the `<head>` of your HTML document:

```html
<script src="https://pass.mirpri.com/public/mirpass-v1.js"
        data-app-id="YOUR_APP_ID">
</script>
```

**Attributes:**
- `data-app-id`: Your MirPass Application ID.
- `data-redirect-uri` (Optional): The URI where the authorization server will redirect users after login. This must be an exact match to a Trusted URI configured in the MirPass dashboard. Defaults to the current page URL.
- `data-appearance` (Optional): How to render the logged-in user. Options are `both` (default), `avatar`, `username`, or `none`.
- `data-theme` (Optional): The color theme of the widget. Options are `auto` (default, respects system dark mode), `light`, `dark`, `transparent-light`, or `transparent-dark`.

### 2. Add the Widget Container

Add a `<div>` with the ID `mirpass` wherever you'd like the widget's UI to appear (e.g., in your app's header):

```html
<div id="mirpass"></div>
```

The script will automatically detect this `<div>` and render either a "Sign In" button or the current User's profile dropdown depending on their authentication state.

## Advanced Usage

If you'd like to integrate the widget's authentication state into your own application logic, you can do so by listening to events or reading the global instance.

### Listening to Errors
The widget dispatches a custom event on the `window` object when authentication fails:

```javascript
window.addEventListener('mirpass:error', (event) => {
  console.error('Auth error:', event.detail.message);
  // Handle the error in your UI
});
```

### Accessing User Info
When a user is successfully authenticated, their profile information is available via the global `mirpassWidget` object:

```javascript
// Access the authenticated user data
const userInfo = window.mirpassWidget.userInfo;

if (userInfo) {
  console.log(`Welcome, ${userInfo.preferred_username}!`);
}
```

### Accessing the Authentication Token
The authentication token and session information are stored in the browser's `localStorage` under the key `mirpass_{YOUR_APP_ID}`. You can retrieve the token from storage to authenticate requests to your own backend API.

The stored object contains the following structure:
```json
{
  "access_token": "eyJhb...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "expires_at": 1686993123456,
  "user_info": { ... }
}
```

**Example: Making an Authenticated API Request**
```javascript
const appId = 'YOUR_APP_ID';
const authDataStr = localStorage.getItem(`mirpass_${appId}`);

if (authDataStr) {
  const authData = JSON.parse(authDataStr);
  
  fetch('https://api.yourdomain.com/protected-route', {
    headers: {
      'Authorization': `Bearer ${authData.access_token}`
    }
  })
  .then(response => response.json())
  .then(data => console.log(data));
}
```
