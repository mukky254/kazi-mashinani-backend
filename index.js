const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

console.log('🚀 Starting Kazi Mashinani Backend...');

// Connect to MongoDB
if (MONGODB_URI) {
  console.log('🔗 Connecting to MongoDB...');
  mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));
} else {
  console.log('❌ MONGODB_URI not set');
}

// Simple User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  userType: String,
  phone: String,
  location: String,
}, { timestamps: true });

const jobSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  location: String,
  salary: Number,
  duration: String,
  employer: String,
  status: { type: String, default: 'open' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Job = mongoose.model('Job', jobSchema);

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Kazi Mashinani API 🚀',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, userType, phone, location } = req.body;
    
    const user = new User({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      userType,
      phone,
      location
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User created!',
      user: { id: user._id, name, email, userType, phone, location }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// SIGNIN  
app.post('/api/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }
    
    res.json({
      success: true,
      message: 'Login successful!',
      user: { id: user._id, name: user.name, email, userType: user.userType }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET JOBS
app.get('/api/jobs', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const jobs = await Job.find({ status: 'open' });
      return res.json({ success: true, jobs, source: 'database' });
    }
    
    // Mock data
    const mockJobs = [
      {
        _id: '1',
        title: 'Plumber Needed - Nairobi',
        description: 'Fix kitchen sink and drainage',
        category: 'Plumbing',
        location: 'Nairobi West',
        salary: 3500,
        duration: '1 day',
        status: 'open'
      },
      {
        _id: '2', 
        title: 'Web Developer - Remote',
        description: 'Build company website',
        category: 'Technology',
        location: 'Remote',
        salary: 25000,
        duration: '2 weeks',
        status: 'open'
      }
    ];
    
    res.json({ success: true, jobs: mockJobs, source: 'mock-data' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, jobs: [] });
  }
});

// CREATE JOB
app.post('/api/jobs', async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    res.json({ success: true, message: 'Job created!', job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = app;

