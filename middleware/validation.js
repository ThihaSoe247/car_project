const { body, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// User registration validation
const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['Admin', 'Staff', 'Moderator'])
    .withMessage('Invalid role specified'),
  handleValidationErrors
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Car creation validation
const validateCarCreation = [
  body('brand')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Brand is required and must be less than 50 characters'),
  body('year')
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Please provide a valid year'),
  body('gear')
    .isIn(['Manual', 'Automatic'])
    .withMessage('Gear must be either Manual or Automatic'),
  body('kilo')
    .isFloat({ min: 0 })
    .withMessage('Kilometer reading must be a positive number'),
  body('wheelDrive')
    .isIn(['FWD', 'RWD', '4WD', 'AWD'])
    .withMessage('Invalid wheel drive type'),
  body('purchasePrice')
    .isFloat({ min: 0 })
    .withMessage('Purchase price must be a positive number'),
  body('priceToSell')
    .isFloat({ min: 0 })
    .withMessage('Selling price must be a positive number'),
  body('purchaseDate')
    .isISO8601()
    .withMessage('Please provide a valid purchase date'),
  handleValidationErrors
];

// Car sale validation
const validateCarSale = [
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Sale price must be a positive number'),
  body('date')
    .isISO8601()
    .withMessage('Please provide a valid sale date'),
  body('kiloAtSale')
    .isFloat({ min: 0 })
    .withMessage('Kilometer at sale must be a positive number'),
  body('buyer.name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Buyer name is required'),
  body('buyer.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid buyer email'),
  handleValidationErrors
];

// Repair validation
const validateRepair = [
  body('description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Repair description is required and must be less than 500 characters'),
  body('repairDate')
    .isISO8601()
    .withMessage('Please provide a valid repair date'),
  body('cost')
    .isFloat({ min: 0 })
    .withMessage('Repair cost must be a positive number'),
  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateCarCreation,
  validateCarSale,
  validateRepair,
  handleValidationErrors
};
