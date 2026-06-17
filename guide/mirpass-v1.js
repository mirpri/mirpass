/**
 * MirPass Embedding Script v1
 * Drop-in OAuth2 authentication widget for websites
 *
 * Usage:
 *   <head>
 *     <script src="https://pass.mirpri.com/mirpass-v1.min.js"
 *             data-app-id="YOUR_APP_ID"
 *             data-redirect-uri="https://your-site.com/auth/callback">
 *     </script>
 *   </head>
 *   <body>
 *     <div id="mirpass"></div>
 *   </body>
 */

(function () {
  'use strict';

  const AUTH_SERVER_URL = 'https://api.pass.mirpri.com';
  const WIDGET_ID = 'mirpass';

  /**
   * Generate a cryptographically secure random string
   */
  function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = new Uint32Array(length);
    if (window.crypto && crypto.getRandomValues) {
      crypto.getRandomValues(values);
    } else {
      // Fallback for older browsers
      for (let i = 0; i < length; i++) {
        values[i] = Math.floor(Math.random() * chars.length);
      }
    }
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[values[i] % chars.length];
    }
    return result;
  }

  /**
   * Base64URL encode a string
   */
  function base64UrlEncode(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Generate SHA256 hash for PKCE code challenge
   */
  async function sha256(message) {
    if (window.crypto && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      // Convert to hex string to match backend's non-standard PKCE validation
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    throw new Error('Web Crypto API not supported');
  }

  /**
   * MirPass Widget Class
   */
  class MirPassWidget {
    constructor(options) {
      this.appId = options.appId;
      this.redirectUri = options.redirectUri || window.location.href;
      this.scope = 'openid profile email';
      this.usePKCE = true;
      this.appearance = options.appearance || 'both';
      this.theme = options.theme || 'auto';
      this.storageKey = `mirpass_${this.appId}`;
      this.widgetElement = null;
      this.userInfo = null;

      this.init();
    }

    /**
     * Initialize the widget
     */
    async init() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._start());
      } else {
        this._start();
      }
    }

    /**
     * Start the widget after DOM is ready
     */
    async _start() {
      if (!this.appId) {
        this._renderLoggedOut();
        return;
      }

      // Create or find widget container
      this.widgetElement = document.getElementById(WIDGET_ID);
      if (!this.widgetElement) {
        this.widgetElement = document.createElement('div');
        this.widgetElement.id = WIDGET_ID;
        document.body.appendChild(this.widgetElement);
      }

      this._renderLoading();

      // Check for OAuth callback
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      // Handle error response
      if (error) {
        this._handleError(error);
        this._clearCallbackParams();
        this._renderLoggedOut();
        return;
      }

      // Check if this is a callback (has code parameter)
      if (code) {
        const storedState = this._getStoredState();

        if (storedState && state !== storedState.state) {
          this._handleError('State mismatch');
          this._clearCallbackParams();
          this._renderLoggedOut();
          return;
        }

        try {
          await this._exchangeCode(code, storedState);
          this._clearCallbackParams();
          this._renderLoggedIn(this._getUserInfo());
        } catch (err) {
          this._handleError(err.message);
          this._clearCallbackParams();
          this._renderLoggedOut();
        }
        return;
      }

      // Check existing session
      this.userInfo = this._getUserInfo();
      if (this.userInfo) {
        this._renderLoggedIn(this.userInfo);
      } else {
        this._renderLoggedOut();
      }
    }

    /**
     * Initiate login flow
     */
    async _login() {
      const state = generateRandomString(16);

      if (this.usePKCE) {
        const codeVerifier = generateRandomString(43);
        const codeChallenge = await sha256(codeVerifier);
        const stateData = { state, codeVerifier };

        this._storeState(stateData);

        const authUrl = `${AUTH_SERVER_URL}/oauth2/authorize?` +
          `client_id=${encodeURIComponent(this.appId)}&` +
          `response_type=code&` +
          `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
          `state=${encodeURIComponent(state)}&` +
          `code_challenge=${codeChallenge}&` +
          `code_challenge_method=S256&` +
          `scope=${encodeURIComponent(this.scope)}`;

        window.location.href = authUrl;
      } else {
        this._storeState({ state });

        const authUrl = `${AUTH_SERVER_URL}/oauth2/authorize?` +
          `client_id=${encodeURIComponent(this.appId)}&` +
          `response_type=code&` +
          `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
          `state=${encodeURIComponent(state)}&` +
          `scope=${encodeURIComponent(this.scope)}`;

        window.location.href = authUrl;
      }
    }

    /**
     * Logout
     */
    _logout() {
      localStorage.removeItem(this.storageKey);
      sessionStorage.removeItem(this.storageKey);
      this.userInfo = null;
      this._renderLoggedOut();
    }

    /**
     * Exchange code for token
     */
    async _exchangeCode(code, storedState) {
      const tokenParams = new URLSearchParams({
        client_id: this.appId,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code: code
      });

      // Add code_verifier if using PKCE
      if (this.usePKCE && storedState && storedState.codeVerifier) {
        tokenParams.append('code_verifier', storedState.codeVerifier);
      }

      const response = await fetch(`${AUTH_SERVER_URL}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Token exchange failed');
      }

      const tokenData = await response.json();
      const { access_token } = tokenData;

      const userInfoResponse = await fetch(`${AUTH_SERVER_URL}/userinfo`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      this.userInfo = await userInfoResponse.json();

      this._storeToken({
        access_token: access_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_in: tokenData.expires_in,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        user_info: this.userInfo
      });

      this._clearState();
      return this.userInfo;
    }

    /**
     * Get user info from storage
     */
    _getUserInfo() {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data).user_info : null;
    }

    /**
     * Store token
     */
    _storeToken(tokenData) {
      localStorage.setItem(this.storageKey, JSON.stringify(tokenData));
    }

    /**
     * Store state
     */
    _storeState(stateData) {
      sessionStorage.setItem(this.storageKey, JSON.stringify(stateData));
    }

    /**
     * Get stored state
     */
    _getStoredState() {
      const data = sessionStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    }

    /**
     * Clear state
     */
    _clearState() {
      sessionStorage.removeItem(this.storageKey);
    }

    /**
     * Clear callback params from URL
     */
    _clearCallbackParams() {
      const url = new URL(window.location);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      window.history.replaceState({}, document.title, url.pathname + url.hash);
    }

    /**
     * Handle error
     */
    _handleError(message) {
      console.error(message);
    }

    /**
     * Get theme CSS
     */
    _getThemeStyles() {
      const themes = {
        'light': `
          --mirpass-primary: var(--mirpass-primary, #3097d2);
          --mirpass-primary-text: var(--mirpass-primary-text, #fff);
          --mirpass-bg-base: var(--mirpass-bg-base, #e9edf9);
          --mirpass-bg-container: var(--mirpass-bg-container, #f7f8ff);
          --mirpass-text-base: var(--mirpass-text-base, #3760bf);
          --mirpass-border-color: var(--mirpass-border-color, #a8b5d5);
          --mirpass-hover: var(--mirpass-hover, #e0e6f5);
          --mirpass-error: var(--mirpass-error, #f7768e);
          --mirpass-error-text: var(--mirpass-error-text, #1a1b26);
        `,
        'dark': `
          --mirpass-primary: var(--mirpass-primary, #7dcfff);
          --mirpass-primary-text: var(--mirpass-primary-text, #1a1b26);
          --mirpass-bg-base: var(--mirpass-bg-base, #1a1b26);
          --mirpass-bg-container: var(--mirpass-bg-container, #24283b);
          --mirpass-text-base: var(--mirpass-text-base, #c0caf5);
          --mirpass-border-color: var(--mirpass-border-color, #414868);
          --mirpass-hover: var(--mirpass-hover, #1f2335);
          --mirpass-error: var(--mirpass-error, #f7768e);
          --mirpass-error-text: var(--mirpass-error-text, #1a1b26);
        `,
        'transparent-light': `
          --mirpass-primary: var(--mirpass-primary, #3097d2);
          --mirpass-primary-text: var(--mirpass-primary-text, #fff);
          --mirpass-bg-base: var(--mirpass-bg-base, transparent);
          --mirpass-bg-container: var(--mirpass-bg-container, transparent);
          --mirpass-menu-bg: #f7f8ff;
          --mirpass-text-base: var(--mirpass-text-base, #3760bf);
          --mirpass-border-color: var(--mirpass-border-color, transparent);
          --mirpass-menu-border: #a8b5d5;
          --mirpass-hover: var(--mirpass-hover, rgba(55, 96, 191, 0.1));
          --mirpass-error: var(--mirpass-error, transparent);
          --mirpass-error-text: var(--mirpass-error-text, #f7768e);
        `,
        'transparent-dark': `
          --mirpass-primary: var(--mirpass-primary, #7dcfff);
          --mirpass-primary-text: var(--mirpass-primary-text, #1a1b26);
          --mirpass-bg-base: var(--mirpass-bg-base, transparent);
          --mirpass-bg-container: var(--mirpass-bg-container, transparent);
          --mirpass-menu-bg: #24283b;
          --mirpass-text-base: var(--mirpass-text-base, #c0caf5);
          --mirpass-border-color: var(--mirpass-border-color, transparent);
          --mirpass-menu-border: #414868;
          --mirpass-hover: var(--mirpass-hover, rgba(192, 202, 245, 0.1));
          --mirpass-error: var(--mirpass-error, transparent);
          --mirpass-error-text: var(--mirpass-error-text, #f7768e);
        `
      };

      const common = `
        #${WIDGET_ID} {
          --mirpass-font: var(--mirpass-font, "JetBrains Mono", "Fira Code", Consolas, monospace, "PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", "WenQuanYi Micro Hei", sans-serif);
          --mirpass-radius: var(--mirpass-radius, 2px);
          box-sizing: border-box;
          display: inline-flex;
        }
        #${WIDGET_ID} * {
          box-sizing: border-box;
        }
      `;

      if (this.theme === 'auto' || !themes[this.theme]) {
        return `
          ${common}
          #${WIDGET_ID} { ${themes['light']} }
          @media (prefers-color-scheme: dark) {
            #${WIDGET_ID} { ${themes['dark']} }
          }
        `;
      }
      return `
        ${common}
        #${WIDGET_ID} { ${themes[this.theme]} }
      `;
    }

    /**
     * Render loading state
     */
    _renderLoading() {
      if (!this.widgetElement) return;
      if (this.appearance === 'none') {
        this.widgetElement.innerHTML = '';
        return;
      }

      const isAvatarOnly = this.appearance === 'avatar';
      const loadingText = isAvatarOnly ? '' : 'loading';
      const marginStyle = isAvatarOnly ? 'margin: 0;' : 'margin-right: 8px;';
      const paddingStyle = isAvatarOnly ? 'padding: 0 8px;' : 'padding: 0 16px;';

      this.widgetElement.innerHTML = `
        <style>
          ${this._getThemeStyles()}
          #${WIDGET_ID} .mirpass-loading {
            color: var(--mirpass-text-base);
            font-family: var(--mirpass-font);
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            width: 100%;
            ${paddingStyle}
            background: var(--mirpass-bg-container);
            border: 1px solid var(--mirpass-border-color);
            border-radius: var(--mirpass-radius);
          }
          #${WIDGET_ID} .mirpass-spinner {
            animation: mirpass-spin 1s linear infinite;
            ${marginStyle}
            width: 16px;
            height: 16px;
            border: 2px solid var(--mirpass-border-color);
            border-top-color: var(--mirpass-primary);
            border-radius: 50%;
          }
          @keyframes mirpass-spin {
            to { transform: rotate(360deg); }
          }
        </style>
        <div class="mirpass-loading">
          <div class="mirpass-spinner"></div>
          ${loadingText}
        </div>
      `;
    }

    /**
     * Render logged out state
     */
    _renderLoggedOut() {
      if (!this.widgetElement) return;
      if (this.appearance === 'none') {
        this.widgetElement.innerHTML = '';
        return;
      }

      const isAvatarOnly = this.appearance === 'avatar';
      const btnPadding = isAvatarOnly ? 'padding: 4px 4px;' : 'padding: 4px 16px;';
      const btnContent = isAvatarOnly
        ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 20px; height: 20px;">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
           </svg>`
        : `login`;

      this.widgetElement.innerHTML = `
        <style>
          ${this._getThemeStyles()}
          #${WIDGET_ID} .mirpass-btn {
            background: var(--mirpass-primary);
            color: var(--mirpass-primary-text);
            border: 1px solid var(--mirpass-primary);
            ${btnPadding}
            border-radius: var(--mirpass-radius);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: var(--mirpass-font);
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }
          #${WIDGET_ID} .mirpass-btn:hover {
            opacity: 0.9;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          #${WIDGET_ID} .mirpass-btn:active {
            transform: translateY(1px);
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
          }
        </style>
        <button class="mirpass-btn" onclick="window.mirpassWidget._login()" title="${isAvatarOnly ? 'login' : ''}">
          ${btnContent}
        </button>
      `;
    }

    /**
     * Render logged in state
     */
    _renderLoggedIn(userInfo) {
      if (!this.widgetElement) return;
      if (this.appearance === 'none') {
        this.widgetElement.innerHTML = '';
        return;
      }

      const avatarUrl = userInfo?.avatar_url || '';
      const username = userInfo?.preferred_username || 'User';
      const hasAvatar = avatarUrl && avatarUrl.trim() !== '';

      const showAvatar = this.appearance === 'both' || this.appearance === 'avatar';
      const showUsername = this.appearance === 'both' || this.appearance === 'username';

      let userContent = '';
      if (showAvatar) {
        userContent += hasAvatar
          ? `<img class="mirpass-avatar" src="${avatarUrl}" alt="${username}">`
          : `<div class="mirpass-avatar-placeholder">${username.charAt(0).toUpperCase()}</div>`;
      }
      if (showUsername) {
        userContent += `<span class="mirpass-username">${username}</span>`;
      }

      this.widgetElement.innerHTML = `
        <style>
          ${this._getThemeStyles()}
          #${WIDGET_ID} .mirpass-container {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--mirpass-font);
            color: var(--mirpass-text-base);
            height: 100%;
          }
          #${WIDGET_ID} .mirpass-user {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 0 2px;
            background: var(--mirpass-bg-container);
            border: 1px solid var(--mirpass-border-color);
            border-radius: var(--mirpass-radius);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            height: 100%;
            user-select: none;
          }
          #${WIDGET_ID} .mirpass-user:hover {
            background: var(--mirpass-hover);
          }
          #${WIDGET_ID} .mirpass-user:active {
            transform: scale(0.98);
          }
          #${WIDGET_ID} .mirpass-avatar {
            width: auto;
            height: 30px;
            aspect-ratio: 1 / 1;
            max-height: calc(100% - 4px);
            border-radius: var(--mirpass-radius);
            object-fit: cover;
            border: 1px solid var(--mirpass-border-color);
            margin: 4px 0;
          }
          #${WIDGET_ID} .mirpass-avatar-placeholder {
            width: 24px;
            height: 24px;
            border-radius: var(--mirpass-radius);
            background: var(--mirpass-bg-base);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--mirpass-primary);
            font-size: 12px;
            border: 1px solid var(--mirpass-border-color);
          }
          #${WIDGET_ID} .mirpass-username {
            font-size: 14px;
            font-weight: 500;
            margin: 0 6px;
          }
          #${WIDGET_ID} .mirpass-menu {
            visibility: hidden;
            opacity: 0;
            transform: translateY(4px);
            position: absolute;
            top: 100%;
            right: 0;
            padding-top: 4px; /* hover gap */
            min-width: 160px;
            z-index: 1000;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          #${WIDGET_ID} .mirpass-container:hover .mirpass-menu,
          #${WIDGET_ID} .mirpass-user:focus-visible + .mirpass-menu {
            visibility: visible;
            opacity: 1;
            transform: translateY(0);
          }
          #${WIDGET_ID} .mirpass-menu-inner {
            background: var(--mirpass-menu-bg, var(--mirpass-bg-container));
            border: 1px solid var(--mirpass-menu-border, var(--mirpass-border-color));
            border-radius: var(--mirpass-radius);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            padding: 4px;
          }
          #${WIDGET_ID} .mirpass-menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            color: var(--mirpass-text-base);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            border: none;
            background: none;
            cursor: pointer;
            font-family: inherit;
            text-align: left;
            transition: all 0.2s;
            width: 100%;
            border-radius: calc(var(--mirpass-radius) - 1px);
          }
          #${WIDGET_ID} .mirpass-menu-item:hover {
            background: var(--mirpass-hover);
          }
          #${WIDGET_ID} .mirpass-menu-item svg {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
            color: var(--mirpass-primary);
            transition: transform 0.2s;
          }
          #${WIDGET_ID} .mirpass-menu-item:hover svg {
            transform: scale(1.1);
          }
          #${WIDGET_ID} .mirpass-divider {
            height: 1px;
            background: var(--mirpass-menu-border, var(--mirpass-border-color));
            margin: 4px 0;
          }
        </style>
        <div class="mirpass-container">
          <div class="mirpass-user" title="Signed in as ${username}">
            ${userContent}
          </div>
          <div class="mirpass-menu">
            <div class="mirpass-menu-inner">
              <a href="https://pass.mirpri.com/#/dashboard" target="_blank" class="mirpass-menu-item">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Dashboard
              </a>
              <div class="mirpass-divider"></div>
              <button class="mirpass-menu-item" onclick="window.mirpassWidget._logout()">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }

  /**
   * Auto-initialize from script tag attributes
   */
  function autoInit() {
    const script = document.currentScript || document.querySelector('script[src*="mirpass-v1.js"]');

    if (!script) {
      return;
    }

    const appId = script.getAttribute('data-app-id') || script.getAttribute('data-appid');
    const redirectUri = script.getAttribute('data-redirect-uri') || script.getAttribute('data-redirecturi');
    const appearance = script.getAttribute('data-appearance') || 'both';
    const theme = script.getAttribute('data-theme') || 'auto';

    if (!appId) {
      console.error('[MirPass] data-app-id attribute is required');
      return;
    }

    // Create global instance
    window.mirpassWidget = new MirPassWidget({
      appId: appId,
      redirectUri: redirectUri,
      appearance: appearance,
      theme: theme
    });
  }

  // Auto-initialize
  autoInit();
})();
