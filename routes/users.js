const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
});

// Search workers
router.get('/workers', async (req, res) => {
  try {
    const { skills, location, rating, page = 1, limit = 10 } = req.query;

    const filter = { userType: 'worker' };

    if (skills) {
      filter.skills = { $in: skills.split(',').map(skill => new RegExp(skill.trim(), 'i')) };
    }

    if (location) {
      filter.location = new RegExp(location, 'i');
    }

    if (rating) {
      filter.rating = { $gte: parseFloat(rating) };
    }

    const workers = await User.find(filter)
      .select('-password')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ rating: -1, createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      workers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Search workers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching workers',
      error: error.message
    });
  }
});

// Rate user
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update rating
    const newTotalRatings = user.totalRatings + 1;
    const newRating = ((user.rating * user.totalRatings) + rating) / newTotalRatings;

    user.rating = parseFloat(newRating.toFixed(1));
    user.totalRatings = newTotalRatings;

    await user.save();

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      newRating: user.rating
    });

  } catch (error) {
    console.error('Rate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting rating',
      error: error.message
    });
  }
});

module.exports = router;
