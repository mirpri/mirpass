# MirPass 🛡️

**The Open-Source Single Sign-On (SSO) & Identity Platform for Developers.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Go](https://img.shields.io/badge/backend-Go-00ADD8.svg)
![React](https://img.shields.io/badge/frontend-React-61DAFB.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

MirPass is a secure, lightweight, and completely self-hostable authentication solution. It is designed to help developers secure their applications and manage user identities without relying on expensive, black-box third-party providers.

Whether you are building a personal project or an enterprise ecosystem, MirPass provides the **Identity Provider (IdP)** capabilities you need with the simplicity you want.

---

## 🚀 Why MirPass?

- **🔑 Seamless SSO**: Integrate centralized login into your apps in minutes using our simple HTTP/JSON protocol.
- **📊 Analytics & Insights**: A rich dashboard featuring real-time charts for Daily Active Users (DAU), New Users, and Traffic patterns.
- **⚡ High Performance**: Built on a robust **Go (Golang)** backend and optimized **MySQL** queries.
- **🎨 Modern Experience**: A polished, responsive interface built with **React**, **TypeScript**, and **Ant Design**.
- **🛡️ Data Sovereignty**: Self-hostable. You own your user data. No vendor lock-in. No hidden fees.

---

## Integrate with MirPass

Stop reinventing the wheel. Use MirPass as the auth backbone for your applications.

### 1. Create your App
Log in to the MirPass dashboard and register a new Application to get your `App ID`.

### 2. Generate Keys
Navigate to the **API Keys** tab in your app management console and generate a secure key for backend communication.

### 3. Implement SSO Flow
1. **Redirect** users to `https://<mirpass-host>/sso/init?app_id=<YOUR_APP_ID>`.
2. **Receive** the callback with a `token`.
3. **Verify** the token via the backend API to authenticate the user securely.

---

## Deploy Your Own

Take control of your infrastructure.

### Prerequisites
- **Go** 1.21+
- **Node.js** 18+
- **MySQL** 8.0+

### Quick Start

1. **Clone the Repo**
   ```bash
   git clone https://github.com/your-username/mirpass.git
   cd mirpass
   ```

2. **Setup Backend**
   ```bash
   cd backend
   # Ensure your MySQL server is running and configured in config/config.go
   go mod tidy
   go run main.go
   ```
   *The server runs on port `8080` by default.*

3. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *The UI runs on port `5173` by default.*

---

## 🤝 Contributing

We are building the best open-source auth solution, and we need your help!

We welcome contributions of all kinds:
- **🐛 Bug Reports**: Found a glitch? Open an issue!
- **💡 Feature Requests**: Have an idea? Tell us.
- **💻 Code**: Fixes, optimizations, and new features are highly appreciated.

### How to Contribute
1. **Star** the repository ⭐ (It really helps!)
2. **Fork** the project.
3. Create your feature branch (`git checkout -b feature/AmazingFeature`).
4. Commit your changes.
5. Push to the branch.
6. Open a **Pull Request**.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.