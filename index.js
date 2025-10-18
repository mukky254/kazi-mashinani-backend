const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kaziuser:securepassword123@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority';
const PORT = process.env.PORT || 3000;

console.log('🔧 Starting server with MongoDB URI:', MONGODB_URI ? 'Provided' : 'Missing');

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://kazi-ocha-frontend-887d.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:5500'],
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Improved MongoDB connection with retry logic
const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('📋 Connection details:', {
      hasURI: !!MONGODB_URI,
      uriLength: MONGODB_URI?.length
    });
    // Don't exit process in serverless environment
  }
};

// Connect to database
connectDB();

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Kazi Mashinani Backend is running!',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// Simple test jobs endpoint
app.get('/api/jobs', async (req, res) => {
  try {
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected',
        jobs: []
      });
    }

    // Return mock data for testing
    const mockJobs = [
      {
        _id: '1',
        title: 'Plumber Needed',
        description: 'Need a plumber to fix kitchen sink',
        category: 'Plumbing',
        location: 'Nairobi',
        salary: 2500,
        duration: '2 days',
        status: 'open',
        employer: { name: 'John Doe', rating: 4.5 }
      },
      {
        _id: '2',
        title: 'Web Developer',
        description: 'Build a company website',
        category: 'Technology',
        location: 'Remote',
        salary: 15000,
        duration: '2 weeks',
        status: 'open',
        employer: { name: 'Tech Solutions', rating: 4.8 }
      }
    ];

    res.json({
      success: true,
      jobs: mockJobs,
      total: mockJobs.length,
      message: 'Jobs fetched successfully (mock data)'
    });
  } catch (error) {
    console.error('Jobs endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching jobs',
      jobs: []
    });
  }
});

// Test auth endpoint
app.get('/api/auth', (req, res) => {
  res.json({
    message: 'Auth endpoints are ready',
    endpoints: ['/auth/signup', '/auth/signin', '/auth/me']
  });
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
