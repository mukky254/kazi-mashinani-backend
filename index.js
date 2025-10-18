const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory data storage (no MongoDB needed)
let users = [];
let jobs = [
  {
    id: '1',
    title: 'Plumber Needed - Nairobi West',
    description: 'Fix kitchen sink and drainage issues urgently',
    category: 'Plumbing',
    location: 'Nairobi West',
    salary: 3500,
    duration: '1 day',
    status: 'open',
    employer: { name: 'John Kamau', phone: '+254712345678' }
  },
  {
    id: '2',
    title: 'Web Developer - Remote',
    description: 'Build company website with modern technologies',
    category: 'Technology', 
    location: 'Remote',
    salary: 25000,
    duration: '2 weeks',
    status: 'open',
    employer: { name: 'Tech Solutions Ltd', phone: '+254711223344' }
  },
  {
    id: '3',
    title: 'House Cleaning - Westlands',
    description: 'General cleaning for 3-bedroom apartment',
    category: 'Cleaning',
    location: 'Westlands, Nairobi',
    salary: 2000,
    duration: '1 day',
    status: 'open',
    employer: { name: 'Sarah Johnson', phone: '+254700111222' }
  }
];

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Kazi Mashinani API 🚀 - WORKING!',
    database: 'Using in-memory storage',
    jobsCount: jobs.length,
    usersCount: users.length,
    timestamp: new Date().toISOString()
  });
});

// SIGNUP
app.post('/api/signup', (req, res) => {
  const { name, email, password, userType, phone, location } = req.body;
  
  const user = {
    id: Date.now().toString(),
    name,
    email,
    password, // In real app, hash this
    userType,
    phone,
    location,
    createdAt: new Date().toISOString()
  };
  
  users.push(user);
  
  res.json({
    success: true,
    message: 'Account created successfully!',
    user: { id: user.id, name, email, userType, phone, location }
  });
});

// SIGNIN
app.post('/api/signin', (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email or password'
    });
  }
  
  res.json({
    success: true,
    message: 'Login successful!',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      phone: user.phone,
      location: user.location
    }
  });
});

// GET JOBS
app.get('/api/jobs', (req, res) => {
  const { category, location, search } = req.query;
  
  let filteredJobs = jobs;
  
  if (category) {
    filteredJobs = filteredJobs.filter(job => 
      job.category.toLowerCase().includes(category.toLowerCase())
    );
  }
  
  if (location) {
    filteredJobs = filteredJobs.filter(job =>
      job.location.toLowerCase().includes(location.toLowerCase())
    );
  }
  
  if (search) {
    filteredJobs = filteredJobs.filter(job =>
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.description.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  res.json({
    success: true,
    jobs: filteredJobs,
    total: filteredJobs.length,
    message: 'Jobs loaded successfully'
  });
});

// CREATE JOB
app.post('/api/jobs', (req, res) => {
  const { title, description, category, location, salary, duration } = req.body;
  
  const job = {
    id: Date.now().toString(),
    title,
    description,
    category,
    location,
    salary,
    duration,
    status: 'open',
    employer: { name: 'Current User', phone: '+254700000000' },
    createdAt: new Date().toISOString()
  };
  
  jobs.push(job);
  
  res.json({
    success: true,
    message: 'Job posted successfully!',
    job
  });
});

// GET SINGLE JOB
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  
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
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running perfectly!',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;

