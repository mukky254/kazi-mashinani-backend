const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const PORT = process.env.PORT || 3000;

console.log('🔧 Starting Kazi Mashinani Backend...');

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://kazi-ocha-frontend-887d.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:5500'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

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
  profilePicture: String,
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
  requirements: [String],
  skillsRequired: [String],
}, { timestamps: true });

// Models
const User = mongoose.model('User', userSchema);
const Job = mongoose.model('Job', jobSchema);

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
};

connectDB();

// Auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

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
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    endpoints: {
      auth: ['POST /api/signup', 'POST /api/signin'],
      jobs: ['GET /api/jobs', 'POST /api/jobs', 'GET /api/jobs/:id'],
      health: 'GET /api/health'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// ==================== AUTH ROUTES ====================

// Sign up
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, userType, phone, location, skills } = req.body;

    // Validation
    if (!name || !email || !password || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and userType are required'
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
      name,
      email,
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
      message: 'User created successfully',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
});

// Sign in
app.post('/api/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

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
      rating: user.rating,
      profilePicture: user.profilePicture
    };

    res.json({
      success: true,
      message: 'Sign in successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error signing in',
      error: error.message
    });
  }
});

// Get current user
app.get('/api/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data'
    });
  }
});

// ==================== JOBS ROUTES ====================

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const { category, location, search, page = 1, limit = 10 } = req.query;

    const filter = { status: 'open' };

    if (category) filter.category = new RegExp(category, 'i');
    if (location) filter.location = new RegExp(location, 'i');
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const jobs = await Job.find(filter)
      .populate('employer', 'name email phone rating profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Job.countDocuments(filter);

    res.json({
      success: true,
      jobs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
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

// Get single job
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('employer', 'name email phone rating profilePicture location');

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
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching job'
    });
  }
});

// Create job (employer only)
app.post('/api/jobs', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can create jobs'
      });
    }

    const { title, description, category, location, salary, duration, requirements, skillsRequired } = req.body;

    // Validation
    if (!title || !description || !category || !location || !salary || !duration) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const job = new Job({
      title,
      description,
      category,
      location,
      salary,
      duration,
      requirements: requirements || [],
      skillsRequired: skillsRequired || [],
      employer: req.user._id
    });

    await job.save();
    await job.populate('employer', 'name email phone rating profilePicture');

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      job
    });

  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating job',
      error: error.message
    });
  }
});

// Get employer's jobs
app.get('/api/my-jobs', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access this endpoint'
      });
    }

    const jobs = await Job.find({ employer: req.user._id })
      .populate('employer', 'name email phone rating profilePicture')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      jobs
    });

  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching jobs'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

// Export for Vercel
module.exports = app;
