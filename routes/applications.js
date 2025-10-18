const express = require('express');
const Application = require('../models/Application');
const Job = require('../models/Job');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply for job (workers only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'worker') {
      return res.status(403).json({
        success: false,
        message: 'Only workers can apply for jobs'
      });
    }

    const { jobId, coverLetter, proposedSalary } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (job.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'This job is no longer accepting applications'
      });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      job: jobId,
      worker: req.user._id
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    const application = new Application({
      job: jobId,
      worker: req.user._id,
      coverLetter,
      proposedSalary: proposedSalary || job.salary
    });

    await application.save();
    await application.populate('worker', 'name email phone rating profilePicture skills');
    await application.populate('job');

    // Add application to job
    job.applications.push(application._id);
    await job.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application
    });

  } catch (error) {
    console.error('Apply job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error applying for job',
      error: error.message
    });
  }
});

// Get worker's applications
router.get('/my-applications', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'worker') {
      return res.status(403).json({
        success: false,
        message: 'Only workers can access this endpoint'
      });
    }

    const applications = await Application.find({ worker: req.user._id })
      .populate({
        path: 'job',
        populate: {
          path: 'employer',
          select: 'name email phone rating profilePicture location'
        }
      })
      .sort({ appliedAt: -1 });

    res.json({
      success: true,
      applications
    });

  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching applications',
      error: error.message
    });
  }
});

// Get applications for employer's jobs
router.get('/employer/applications', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access this endpoint'
      });
    }

    // Find all jobs by this employer
    const jobs = await Job.find({ employer: req.user._id });
    const jobIds = jobs.map(job => job._id);

    const applications = await Application.find({ job: { $in: jobIds } })
      .populate('worker', 'name email phone rating profilePicture skills experience bio')
      .populate('job', 'title salary duration')
      .sort({ appliedAt: -1 });

    res.json({
      success: true,
      applications
    });

  } catch (error) {
    console.error('Get employer applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching applications',
      error: error.message
    });
  }
});

// Update application status (employer only)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status, feedback } = req.body;

    const application = await Application.findById(req.params.id)
      .populate('job')
      .populate('worker', 'name email phone rating profilePicture');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if current user is the job employer
    if (application.job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this application'
      });
    }

    application.status = status;
    if (feedback) application.employerFeedback = feedback;

    // If accepted, update job status and hired worker
    if (status === 'accepted') {
      application.job.status = 'in-progress';
      application.job.hiredWorker = application.worker._id;
      await application.job.save();

      // Reject all other applications for this job
      await Application.updateMany(
        {
          job: application.job._id,
          _id: { $ne: application._id },
          status: 'pending'
        },
        { status: 'rejected' }
      );
    }

    await application.save();

    res.json({
      success: true,
      message: `Application ${status} successfully`,
      application
    });

  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating application',
      error: error.message
    });
  }
});

// Withdraw application (worker only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (application.worker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to withdraw this application'
      });
    }

    await Application.findByIdAndDelete(req.params.id);

    // Remove application from job
    await Job.findByIdAndUpdate(application.job, {
      $pull: { applications: application._id }
    });

    res.json({
      success: true,
      message: 'Application withdrawn successfully'
    });

  } catch (error) {
    console.error('Withdraw application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error withdrawing application',
      error: error.message
    });
  }
});

module.exports = router;
