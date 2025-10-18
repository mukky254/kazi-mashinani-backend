const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// **CORRECT MongoDB URI for your Bahrain cluster**
const MONGODB_URI = 'mongodb+srv://kaziuser:securepassword123@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority';
const JWT_SECRET = process.env.JWT_SECRET || 'kazi-mashinani-jwt-secret-2024';

console.log('🚀 Starting Kazi Mashinani Backend...');
console.log('📍 MongoDB Cluster: Bahrain (me-south-1)');

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://kazi-ocha-frontend-887d.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:5500'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
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
  rating: { type: Number, default: 0 },
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

// **IMPROVED Connection with Better Error Handling**
let connectionAttempts = 0;
const MAX_ATTEMPTS = 3;

const connectDB = async () => {
  try {
    connectionAttempts++;
    console.log(`🔗 MongoDB connection attempt ${connectionAttempts}/${MAX_ATTEMPTS}...`);
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    
    console.log('✅ MongoDB connected successfully!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    console.log('📍 Host:', mongoose.connection.host);
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    if (connectionAttempts < MAX_ATTEMPTS) {
      console.log(`🔄 Retrying in 3 seconds... (${connectionAttempts}/${MAX_ATTEMPTS})`);
      setTimeout(connectDB, 3000);
    } else {
      console.error('💥 Max connection attempts reached. Please check:');
      console.error('   1. MongoDB Atlas cluster is running');
      console.error('   2. IP 0.0.0.0/0 is whitelisted');
      console.error('   3. Username/password are correct');
      console.error('   4. Network connectivity to Bahrain region');
    }
  }
};

// Connection events
mongoose.connection.on('connected', () => {
  console.log('🎉 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
});

// Start connection
connectDB();

// Auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid token' });
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    message: 'Kazi Mashinani Backend API is running! 🚀',
    database: isConnected ? 'Connected' : 'Disconnected',
    cluster: 'Bahrain (me-south-1)',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ['POST /api/signup', 'POST /api/signin', 'GET /api/me'],
      jobs: ['GET /api/jobs', 'POST /api/jobs', 'GET /api/jobs/:id'],
      health: 'GET /api/health',
      debug: 'GET /api/debug'
    }
  });
});

app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    status: 'OK',
    database: isConnected ? 'Connected' : 'Disconnected',
    readyState: mongoose.connection.readyState,
    cluster: 'Bahrain (me-south-1)',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/debug', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    let collections = [];
    let userCount = 0;
    let jobCount = 0;
    
    if (isConnected) {
      collections = await mongoose.connection.db.listCollections().toArray();
      userCount = await User.countDocuments();
      jobCount = await Job.countDocuments();
    }
    
    res.json({
      database: isConnected ? 'Connected' : 'Disconnected',
      readyState: mongoose.connection.readyState,
      cluster: 'Bahrain (me-south-1)',
      connectionAttempts: connectionAttempts,
      collections: collections.map(c => c.name),
      counts: {
        users: userCount,
        jobs: jobCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      database: 'Error',
      error: error.message,
      readyState: mongoose.connection.readyState
    });
  }
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connecting... Please try again in a moment.' 
      });
    }

    const { name, email, password, userType, phone, location, skills } = req.body;

    if (!name || !email || !password || !userType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, password, and user type are required' 
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      userType,
      phone: phone || '',
      location: location || '',
      skills: skills || []
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        phone: user.phone,
        location: user.location,
        skills: user.skills
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account: ' + error.message
    });
  }
});

// SIGNIN
app.post('/api/signin', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connecting... Please try again in a moment.' 
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        phone: user.phone,
        location: user.location,
        skills: user.skills,
        rating: user.rating
      }
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error signing in: ' + error.message
    });
  }
});

// GET JOBS
app.get('/api/jobs', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const jobs = await Job.find({ status: 'open' })
        .populate('employer', 'name email phone rating')
        .sort({ createdAt: -1 })
        .limit(50);

      return res.json({
        success: true,
        jobs,
        total: jobs.length,
        source: 'database'
      });
    }

    // Mock data fallback
    const mockJobs = [
      {
        _id: '1',
        title: 'Emergency Plumber - Nairobi West',
        description: 'Urgent plumbing work for kitchen sink and drainage system. Must have own tools.',
        category: 'Plumbing',
        location: 'Nairobi West',
        salary: 3500,
        duration: '1 day',
        status: 'open',
        employer: {
          _id: 'emp1',
          name: 'John Kamau',
          email: 'john@example.com',
          phone: '+254712345678',
          rating: 4.5
        },
        createdAt: new Date().toISOString()
      },
      {
        _id: '2',
        title: 'Full Stack Developer - Remote',
        description: 'Build e-commerce website with React, Node.js, and MongoDB. Payment integration required.',
        category: 'Technology',
        location: 'Remote',
        salary: 45000,
        duration: '3 weeks',
        status: 'open',
        employer: {
          _id: 'emp2',
          name: 'Tech Solutions Ltd',
          email: 'info@techsolutions.co.ke',
          phone: '+254711223344',
          rating: 4.8
        },
        createdAt: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      jobs: mockJobs,
      total: mockJobs.length,
      source: 'mock-data',
      message: 'Database connecting... showing sample jobs'
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching jobs',
      jobs: []
    });
  }
});

// CREATE JOB
app.post('/api/jobs', auth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    if (req.user.userType !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can create jobs'
      });
    }

    const { title, description, category, location, salary, duration } = req.body;

    const job = new Job({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      location: location.trim(),
      salary: Number(salary),
      duration: duration.trim(),
      employer: req.user._id
    });

    await job.save();
    await job.populate('employer', 'name email phone rating');

    res.status(201).json({
      success: true,
      message: 'Job posted successfully!',
      job
    });

  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating job: ' + error.message
    });
  }
});

module.exports = app;


