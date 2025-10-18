const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// This will show us the exact MongoDB connection error
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kaziuser:securepassword123@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority';

console.log('🔧 Testing MongoDB connection...');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
})
.then(() => {
  console.log('✅ MongoDB connected successfully!');
})
.catch(error => {
  console.error('❌ MongoDB connection failed:');
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Error code:', error.code);
  
  if (error.message.includes('authentication failed')) {
    console.log('🔐 AUTHENTICATION FAILED: Password is incorrect');
    console.log('💡 Please reset the password for user "kaziuser" in MongoDB Atlas');
  }
});

// Simple routes for testing
app.get('/', (req, res) => {
  res.json({
    message: 'Kazi Mashinani Backend',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/jobs', (req, res) => {
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
      description: 'Build company website with modern technologies',
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

app.get('/api/connection-status', (req, res) => {
  res.json({
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    readyState: mongoose.connection.readyState,
    mongooseState: mongoose.STATES[mongoose.connection.readyState],
    timestamp: new Date().toISOString()
  });
});

module.exports = app;


