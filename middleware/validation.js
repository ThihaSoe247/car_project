const { body, validationResult } = require("express-validator");

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

// User registration validation
const validateRegistration = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("role")
    .optional()
    .isIn(["Admin", "Staff", "Moderator"])
    .withMessage("Invalid role specified"),
  handleValidationErrors,
];

// User creation validation (for Moderators)
const validateUserCreation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("role")
    .optional()
    .isIn(["Admin", "Staff"])
    .withMessage("Role must be either Admin or Staff"),
  handleValidationErrors,
];

// User update validation (for Moderators)
const validateUserUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("role")
    .optional()
    .isIn(["Admin", "Staff"])
    .withMessage("Role must be either Admin or Staff"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  handleValidationErrors,
];

// User login validation
const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

// Car creation validation
const validateCarCreation = [
  body("brand")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Brand is required and must be less than 50 characters"),
  body("year")
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage("Please provide a valid year"),
  body("gear")
    .isIn(["Manual", "Automatic"])
    .withMessage("Gear must be either Manual or Automatic"),
  body("kilo")
    .isFloat({ min: 0 })
    .withMessage("Kilometer reading must be a positive number"),
  body("wheelDrive")
    .isIn(["FWD", "RWD", "4WD", "AWD"])
    .withMessage("Invalid wheel drive type"),
  body("purchasePrice")
    .isFloat({ min: 0 })
    .withMessage("Purchase price must be a positive number"),
  body("priceToSell")
    .isFloat({ min: 0 })
    .withMessage("Selling price must be a positive number"),
  body("purchaseDate")
    .isISO8601()
    .withMessage("Please provide a valid purchase date"),
  handleValidationErrors,
];
const validateCarSale = [
  body("boughtType")
    .isIn(["Paid", "Installment"])
    .withMessage("boughtType must be either 'Paid' or 'Installment'"),

  // Paid sale validation
  body("sale.price")
    .if(body("boughtType").equals("Paid"))
    .isFloat({ min: 0 })
    .withMessage("Sale price must be a positive number"),
  body("sale.soldDate")
    .if(body("boughtType").equals("Paid"))
    .isISO8601()
    .withMessage("Please provide a valid sale date"),
  body("sale.kiloAtSale")
    .if(body("boughtType").equals("Paid"))
    .isFloat({ min: 0 })
    .withMessage("Kilometer at sale must be a positive number"),
  body("sale.buyer.name")
    .if(body("boughtType").equals("Paid"))
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Buyer name is required"),
  body("sale.buyer.email")
    .if(body("boughtType").equals("Paid"))
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid buyer email"),
  body("sale.buyer.passport")
    .if(body("boughtType").equals("Paid"))
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage("Buyer passport is required and must be 5-20 characters"),

  // Installment sale validation
  body("installment.downPayment")
    .if(body("boughtType").equals("Installment"))
    .isFloat({ min: 0 })
    .withMessage("Down payment must be a positive number"),
  body("installment.remainingAmount")
    .if(body("boughtType").equals("Installment"))
    .isFloat({ min: 0 })
    .withMessage("Remaining amount must be a positive number"),
  body("installment.months")
    .if(body("boughtType").equals("Installment"))
    .isInt({ min: 1 })
    .withMessage("Months must be at least 1"),
  body("installment.buyer.name")
    .if(body("boughtType").equals("Installment"))
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Buyer name is required"),
  body("installment.buyer.email")
    .if(body("boughtType").equals("Installment"))
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid buyer email"),
  body("installment.buyer.passport")
    .if(body("boughtType").equals("Installment"))
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage("Buyer passport is required and must be 5–20 characters"),

  handleValidationErrors,
];

// Repair validation
const validateRepair = [
  body("description")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage(
      "Repair description is required and must be less than 500 characters"
    ),
  body("repairDate")
    .isISO8601()
    .withMessage("Please provide a valid repair date"),
  body("cost")
    .isFloat({ min: 0 })
    .withMessage("Repair cost must be a positive number"),
  handleValidationErrors,
];

module.exports = {
  validateRegistration,
  validateUserCreation,
  validateUserUpdate,
  validateLogin,
  validateCarCreation,
  validateCarSale,
  validateRepair,
  handleValidationErrors,
};
