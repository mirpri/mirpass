const express = require('express');
const path = require('path');
const app = express();
const Database = require('better-sqlite3');

// Connect to database
const db = new Database('mirpass.db', { verbose: console.log });

// Create tables if they don't exist
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// Parse JSON request body
app.use(express.json());

// Serve static files from Vue build directory
app.use(express.static(path.join(__dirname, 'mirpass-front/dist')));

// Register endpoint
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  
  console.log('Register attempt:', username, password);
  
  try {
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    stmt.run(username, password);
    return res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error('Registration error:', err.message);
    return res.status(400).json({ message: 'Username already exists' });
  }
});

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', username, password);
  
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
    const user = stmt.get(username, password);
    
    if (user) {
      return res.json({ message: 'Login successful' });
    } else {
      return res.status(400).json({ message: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// For all other GET requests, send back the Vue app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'mirpass-front/dist/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Close database on exit
process.on('SIGINT', () => {
  db.close();
  console.log('Database connection closed');
  process.exit(0);
});