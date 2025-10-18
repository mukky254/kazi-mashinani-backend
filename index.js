const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// **EXACT MongoDB URI from your setup**
const MONGODB_URI = 'mongodb+srv://kaziuser:securepassword123@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority';
const JWT_SECRET = process.env.JWT_SECRET || 'kazi-mashinani-secret-2024';

console.log('🚀 Starting Kazi Mashinani Backend...');
console.log('📡 MongoDB URI configured');

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

// **IMPROVED MongoDB Connection**
let isConnected = false;

const connectWithRetry = () => {
  console.log('🔗 Attempting MongoDB connection...');
  
  mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    isConnected = true;
    console.log('✅ MongoDB connected successfully!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('🔄 Retrying in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};

// Connection events
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('🎉 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('⚠️ Mongoose disconnected');
});

// Start connection
connectWithRetry();

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Kazi Mashinani Backend API is running! 🚀',
    database: isConnected ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ['POST /api/signup', 'POST /api/signin', 'GET /api/me'],
      jobs: ['GET /api/jobs', 'POST /api/jobs', 'GET /api/jobs/:id'],
      health: 'GET /api/health',
      debug: 'GET /api/debug'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: isConnected ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Debug endpoint
app.get('/api/debug', async (req, res) => {
  try {
    let collections = [];
    if (isConnected) {
      collections = await mongoose.connection.db.listCollections().toArray();
    }
    
    res.json({
      database: isConnected ? 'Connected' : 'Disconnected',
      readyState: mongoose.connection.readyState,
      isConnected: isConnected,
      collections: collections.map(c => c.name),
      models: ['User', 'Job'],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      database: 'Error',
      error: error.message,
      isConnected: false
    });
  }
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not available. Please try again in a few moments.' 
      });
    }

    const { name, email, password, userType, phone, location, skills } = req.body;

    // Validation
    if (!name || !email || !password || !userType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, password, and user type are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }

    // Create user
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

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Return user data (without password)
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      phone: user.phone,
      location: user.location,
      skills: user.skills,
      rating: user.rating
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      token,
      user: userResponse
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
    if (!isConnected) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not available. Please try again in a few moments.' 
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Return user data
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      phone: user.phone,
      location: user.location,
      skills: user.skills,
      rating: user.rating
    };

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error signing in: ' + error.message
    });
  }
});

// GET CURRENT USER
app.get('/api/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user data'
    });
  }
});

// GET JOBS
app.get('/api/jobs', async (req, res) => {
  try {
    // If DB connected, get real jobs
    if (isConnected) {
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

    // Fallback mock data
    const mockJobs = [
      {
        _id: '1',
        title: 'Emergency Plumber Needed',
        description: 'Urgent plumbing work for kitchen sink and drainage issues in Nairobi West area.',
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
        createdAt: new Date().toISOString(),
        requirements: ['License', 'Tools', 'Experience']
      },
      {
        _id: '2',
        title: 'Full Stack Web Developer',
        description: 'Build responsive e-commerce website with payment integration and admin dashboard.',
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
        createdAt: new Date().toISOString(),
        requirements: ['JavaScript', 'React', 'Node.js', 'MongoDB']
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
    if (!isConnected) {
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

    if (!title || !description || !category || !location || !salary || !duration) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

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

// GET SINGLE JOB
app.get('/api/jobs/:id', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const job = await Job.findById(req.params.id)
      .populate('employer', 'name email phone rating location');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      job
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching job'
    });
  }
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

module.exports = app;


