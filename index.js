const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Use environment variable for MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kaziuser:securepassword123@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-2024';

console.log('🔧 Starting backend...');
console.log('📡 MongoDB URI available:', !!MONGODB_URI);

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://kazi-ocha-frontend-887d.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:5500'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { type: String, enum: ['employer', 'worker'], required: true },
  phone: String,
  location: String,
  skills: [String],
}, { timestamps: true });

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  salary: { type: Number, required: true },
  duration: { type: String, required: true },
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['open', 'in-progress', 'completed'], default: 'open' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Job = mongoose.model('Job', jobSchema);

// Password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Database connection with detailed logging
let dbConnected = false;

const connectDB = async () => {
  try {
    console.log('🔗 Attempting MongoDB connection...');
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });

    dbConnected = true;
    console.log('✅ MongoDB connected successfully!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('Error:', error.message);
    console.error('Please check:');
    console.error('1. MONGODB_URI environment variable in Vercel');
    console.error('2. MongoDB Atlas username/password');
    console.error('3. IP whitelist (0.0.0.0/0)');
    console.error('4. Cluster is running in Bahrain region');
  }
};

// Connection events
mongoose.connection.on('connected', () => {
  dbConnected = true;
  console.log('🎉 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  dbConnected = false;
  console.error('❌ Mongoose connection error:', err.message);
});

// Start connection
connectDB();

// Auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid token' });
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Kazi Mashinani Backend API 🚀',
    database: dbConnected ? 'Connected' : 'Disconnected',
    cluster: 'Bahrain (me-south-1)',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: dbConnected ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/debug', (req, res) => {
  res.json({
    database: dbConnected ? 'Connected' : 'Disconnected',
    readyState: mongoose.connection.readyState,
    mongooseState: mongoose.connection._readyState,
    cluster: 'Bahrain (me-south-1)',
    hasMongoURI: !!MONGODB_URI,
    timestamp: new Date().toISOString()
  });
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not available. Please try again later.' 
      });
    }

    const { name, email, password, userType, phone, location, skills } = req.body;

    if (!name || !email || !password || !userType) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User exists' });
    }

    const user = new User({ name, email, password, userType, phone, location, skills });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      message: 'User created',
      token,
      user: { id: user._id, name, email, userType, phone, location, skills }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// SIGNIN
app.post('/api/signin', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      message: 'Sign in successful',
      token,
      user: { id: user._id, name: user.name, email, userType: user.userType, phone: user.phone, location: user.location, skills: user.skills }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET JOBS
app.get('/api/jobs', async (req, res) => {
  try {
    if (dbConnected) {
      const jobs = await Job.find({ status: 'open' })
        .populate('employer', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(20);

      return res.json({ success: true, jobs, total: jobs.length, source: 'database' });
    }

    // Mock data
    const mockJobs = [
      {
        _id: '1', title: 'Plumber Needed', description: 'Fix kitchen sink', category: 'Plumbing',
        location: 'Nairobi', salary: 2500, duration: '1 day', status: 'open',
        employer: { name: 'John Doe', email: 'john@example.com', phone: '+254712345678' }
      },
      {
        _id: '2', title: 'Web Developer', description: 'Build website', category: 'Technology',
        location: 'Remote', salary: 15000, duration: '2 weeks', status: 'open', 
        employer: { name: 'Tech Solutions', email: 'info@tech.com', phone: '+254711223344' }
      }
    ];

    res.json({ success: true, jobs: mockJobs, total: mockJobs.length, source: 'mock-data' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message, jobs: [] });
  }
});

module.exports = app;


