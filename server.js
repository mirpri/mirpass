const express = require('express');
const path = require('path');
const app = express();
const Database = require('better-sqlite3');
const session = require('express-session');

const cors = require('cors');
const bcrypt = require('bcrypt');

// Connect to database
const db = new Database('mirpass.db', { verbose: console.log });

// Create tables if they don't exist
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// Parse JSON request body
app.use(express.json());

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    const allowedOrigins = ['http://127.0.0.1:3000', 'http://localhost:3000', 'http://localhost:4000', 'null'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Origin blocked by CORS:', origin);
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add session middleware
app.use(session({
  secret: '123456', // Replace with a strong secret key
  resave: true, // Changed to true to ensure session is saved
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    sameSite: 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Register endpoint
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  console.log('Register attempt:', username, password);

  try {
    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    if (password.length < 8 || password.length > 20 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ message: 'Password must be 8-20 characters long and contain at least one letter and one number' });
    }

    const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    stmt.run(username, email, hashedPassword);
    return res.status(201).json({ message: 'User created' });

  } catch (err) {
    console.error('Registration error:', err.message);
    let errormessage;
    if (err.message == 'UNIQUE constraint failed: users.username') {
      errormessage = 'Username already exists';
    } else if (err.message == 'UNIQUE constraint failed: users.email') {
      errormessage = 'Email already registered';
    } else {
      errormessage = 'Something went wrong!';
    }
    return res.status(400).json({ message: errormessage });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('Login attempt:', username, password);

  try {
    // Retrieve the user by username
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);

    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      req.session.username = username; // Store username in session
      return res.json({ message: 'Login successful' });
    } else {
      return res.status(400).json({ message: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout endpoint
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Clear the session cookie
    res.json({ message: 'Logged out successfully' });
  });
});


//serve user info for logined session
app.get('/user-info', (req, res) => {
  if (req.session.username) {
    try {
      // Fetch all user data in a single query
      const user = db.prepare('SELECT email, created_at FROM users WHERE username = ?').get(req.session.username);

      if (user) {
        res.json({
          username: req.session.username,
          email: user.email,
          registrationDate: user.created_at,
        });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (err) {
      console.error('Error fetching user info:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
});


// for successful login
app.get('/success', (req, res) => {
  console.log('redirect to:', req.session.from);
  res.redirect(req.session.from);
});

app.get('/', (req, res, next) => {
  const from = req.query.from || 'dashboard.html';
  req.session.from = from; // Store the redirect URL in the session
  console.log('from:', from);
  if(req.session.username) {
    res.redirect('/success');
  }else{
    res.sendFile(path.join(__dirname, 'mirpass-front/dist/index.html'));
  }
});

// Serve static files from Vue build directory
app.use(express.static(path.join(__dirname, 'mirpass-front/dist')));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// Close database on exit
process.on('SIGINT', () => {
  db.close();
  console.log('Database connection closed');
  process.exit(0);
});

