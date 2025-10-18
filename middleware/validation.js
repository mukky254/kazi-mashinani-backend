const validator = require('validator');

const validateSignup = (req, res, next) => {
  const { name, email, password, userType, phone } = req.body;
  
  const errors = [];

  if (!name || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  if (!email || !validator.isEmail(email)) {
    errors.push('Valid email is required');
  }

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!userType || !['employer', 'worker'].includes(userType)) {
    errors.push('User type must be either employer or worker');
  }

  if (phone && !validator.isMobilePhone(phone, 'any')) {
    errors.push('Valid phone number is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

const validateJob = (req, res, next) => {
  const { title, description, category, location, salary, duration } = req.body;
  
  const errors = [];

  if (!title || title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long');
  }

  if (!description || description.trim().length < 10) {
    errors.push('Description must be at least 10 characters long');
  }

  if (!category || category.trim().length < 2) {
    errors.push('Category is required');
  }

  if (!location || location.trim().length < 2) {
    errors.push('Location is required');
  }

  if (!salary || isNaN(salary) || salary < 0) {
    errors.push('Valid salary is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

module.exports = { validateSignup, validateJob };
