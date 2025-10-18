const express = require('express');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { auth, optionalAuth } = require('../middleware/auth');
const { validateJob } = require('../middleware/validation');

const router = express.Router();

// Get all jobs with filters and pagination
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      category,
      location,
      minSalary,
      maxSalary,
      status = 'open',
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { status: 'open' };

    // Apply filters
    if (category) filter.category = new RegExp(category, 'i');
    if (location) filter.location = new RegExp(location, 'i');
    if (minSalary || maxSalary) {
      filter.salary = {};
      if (minSalary) filter.salary.$gte = parseInt(minSalary);
      if (maxSalary) filter.salary.$lte = parseInt(maxSalary);
    }

    // Search in title and description
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { category: new RegExp(search, 'i') }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const jobs = await Job.find(filter)
      .populate('employer', 'name email phone rating profilePicture')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Job.countDocuments(filter);

    // Check if user has applied to each job
    if (req.user) {
      const jobIds = jobs.map(job => job._id);
      const applications = await Application.find({
        job: { $in: jobIds },
        worker: req.user._id
      });

      const appliedJobIds = new Set(applications.map(app => app.job.toString()));

      jobs.forEach(job => {
        job._doc.hasApplied = appliedJobIds.has(job._id.toString());
      });
    }

    res.json({
      success: true,
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching jobs',
      error: error.message
    });
  }
});

// Get single job
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('employer', 'name email phone rating profilePicture location')
      .populate('hiredWorker', 'name email phone rating profilePicture');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Increment views
    job.views += 1;
    await job.save();

    // Check if user has applied
    if (req.user) {
      const application = await Application.findOne({
        job: job._id,
        worker: req.user._id
      });
      job._doc.hasApplied = !!application;
    }

    res.json({
      success: true,
      job
    });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching job',
      error: error.message
    });
  }
});

// Create job (employers only)
router.post('/', auth, validateJob, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can create jobs'
      });
    }

    const job = new Job({
      ...req.body,
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

// Update job (employer only)
router.put('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job'
      });
    }

    const updates = req.body;
    const allowedUpdates = ['title', 'description', 'category', 'location', 'salary', 'duration', 'requirements', 'skillsRequired', 'isUrgent'];
    
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        job[key] = updates[key];
      }
    });

    await job.save();
    await job.populate('employer', 'name email phone rating profilePicture');

    res.json({
      success: true,
      message: 'Job updated successfully',
      job
    });

  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating job',
      error: error.message
    });
  }
});

// Delete job (employer only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job'
      });
    }

    await Job.findByIdAndDelete(req.params.id);
    await Application.deleteMany({ job: req.params.id });

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting job',
      error: error.message
    });
  }
});

// Get employer's jobs
router.get('/employer/my-jobs', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access this endpoint'
      });
    }

    const jobs = await Job.find({ employer: req.user._id })
      .populate('hiredWorker', 'name email phone rating profilePicture')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      jobs
    });

  } catch (error) {
    console.error('Get employer jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching jobs',
      error: error.message
    });
  }
});

module.exports = router;
