# Mirpass

Mirpass is an authentication and login system built using Node.js, Express, and Vue.js. It provides a robust and secure way to manage user authentication and authorization for web applications.

## Features

- **User Authentication**: Secure login and registration system.
- **Express Backend**: A lightweight and efficient server-side framework.
- **Vue.js Frontend**: A modern and reactive user interface.
- **Responsive Design**: Optimized for both desktop and mobile devices.

### Advanced
- **Password Encryption**: Password is encrypted with bcrypt.

## Installation

1. Clone the repository:
   ```bash
   git clone ...
   ```

2. Navigate to the project directory:
   ```bash
   cd mirpass
   ```

3. Install backend dependencies:
   ```bash
   npm install
   ```

4. Navigate to the frontend directory:
   ```bash
   cd mirpass-front
   ```

5. Install frontend dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the backend server:
   ```bash
   node server.js
   ```

2. Start the frontend development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000` to access the application.

## Folder Structure

- **mirpass/**: Root directory containing backend code.
  - `server.js`: Entry point for the backend server.
  - `mirpass.db`: Database file for storing user data.
- **mirpass-front/**: Frontend directory.
  - `src/`: Contains Vue.js components and assets.
  - `public/`: Static files like `favicon.ico`.
  - `vite.config.js`: Configuration file for Vite.

