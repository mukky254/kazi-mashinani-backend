const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// MongoDB URI
const MONGODB_URI = 'mongodb+srv://kaziuser:securepassword123@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority';

app.use(cors());
app.use(express.json());

console.log('🔧 Starting server with MongoDB URI:', MONGODB_URI);

// Simple connection without retry
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully!');
})
.catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Kazi Mashinani API',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    readyState: mongoose.connection.readyState
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    readyState: mongoose.connection.readyState
  });
});

app.get('/api/jobs', (req, res) => {
  // Always return mock data for now
  const mockJobs = [
    {
      _id: '1',
      title: 'Plumber Needed - Urgent',
      description: 'Fix kitchen sink and drainage issues',
      category: 'Plumbing',
      location: 'Nairobi',
      salary: 3000,
      duration: '1 day',
      status: 'open'
    },
    {
      _id: '2', 
      title: 'Web Developer',
      description: 'Build company website',
      category: 'Technology',
      location: 'Remote',
      salary: 25000,
      duration: '2 weeks',
      status: 'open'
    }
  ];
  
  res.json({
    success: true,
    jobs: mockJobs,
    total: mockJobs.length,
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      // Try to create a test document
      const Test = mongoose.model('Test', new mongoose.Schema({ name: String }));
      await Test.create({ name: 'test-' + Date.now() });
      const count = await Test.countDocuments();
      
      res.json({
        success: true,
        message: 'Database working!',
        testCount: count
      });
    } else {
      res.json({
        success: false,
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      });
    }
  } catch (error) {
    res.json({
      success: false,
      message: 'Database error: ' + error.message
    });
  }
});

module.exports = app;


