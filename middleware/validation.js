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
    .isIn(["Admin", "Moderator"])
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
    .isIn(["Admin"])
    .withMessage("Role must be Admin"),
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
    .isIn(["Admin"])
    .withMessage("Role must be Admin"),
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
  body("licenseNo")
    .isString()
    .withMessage("License number must be a string")
    .trim()
    .customSanitizer((value) =>
      typeof value === "string" ? value.toUpperCase() : value
    )
    .isLength({ min: 2, max: 20 })
    .withMessage("License number must be between 2 and 20 characters")
    .matches(/^[A-Za-z0-9\- ]+$/)
    .withMessage("License number can only contain letters, numbers, spaces, and dashes"),
  body("brand")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Brand is required and must be less than 50 characters"),
  body("model")
    .isString()
    .withMessage("Model must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Model is required and must be less than 100 characters"),
  body("year")
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage("Please provide a valid year"),
  body("enginePower")
    .isString()
    .withMessage("Engine power must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Engine power is required and must be less than 100 characters"),
  body("gear")
    .isIn(["Manual", "Automatic"])
    .withMessage("Gear must be either Manual or Automatic"),
  body("color")
    .isString()
    .withMessage("Color must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Color is required and must be less than 50 characters"),
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
  // Repairs validation (optional, for car creation)
  body("repairs")
    .optional()
    .customSanitizer((value) => {
      if (value === undefined || value === null) {
        return value;
      }
      // If it's a string, try to parse it as JSON (common with multipart/form-data)
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return parsed;
        } catch (e) {
          // Return as-is if parsing fails, validation will catch it
          return value;
        }
      }
      return value;
    })
    .custom((value) => {
      // If repairs is provided, it must be an array
      if (value !== undefined && value !== null && !Array.isArray(value)) {
        throw new Error("Repairs must be an array");
      }
      return true;
    }),
  // Validate array items (only runs if repairs is an array)
  body("repairs.*.description")
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Each repair description must be between 1 and 500 characters"),
  body("repairs.*.repairDate")
    .optional()
    .isISO8601()
    .withMessage("Each repair date must be a valid ISO8601 date"),
  body("repairs.*.cost")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Each repair cost must be a positive number"),
  handleValidationErrors,
];
// Paid sale validation (for /api/car/:id/sell)
const validatePaidSale = [
  body("sale.price")
    .isFloat({ min: 0 })
    .withMessage("Sale price must be a positive number"),
  body("sale.soldDate")
    .isISO8601()
    .withMessage("Please provide a valid sale date"),
  body("sale.kiloAtSale")
    .isFloat({ min: 0 })
    .withMessage("Kilometer at sale must be a positive number"),
  body("sale.buyer.name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Buyer name is required"),
  body("sale.buyer.email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid buyer email"),
  body("sale.buyer.passport")
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage("Buyer passport is required and must be 5-20 characters"),
  handleValidationErrors,
];

// Installment sale validation (for /api/car/:id/sell-installment)
const validateInstallmentSale = [
  body("installment.downPayment")
    .isFloat({ min: 0 })
    .withMessage("Down payment must be a positive number"),
  body("installment.remainingAmount")
    .isFloat({ min: 0 })
    .withMessage("Remaining amount must be a positive number"),
  body("installment.months")
    .isInt({ min: 1 })
    .withMessage("Months must be at least 1"),
  body("installment.monthlyPayment")
    .isFloat({ min: 0 })
    .withMessage("Monthly payment must be a positive number"),
  body("installment.buyer.name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Buyer name is required"),
  body("installment.buyer.phone")
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage("Please provide a valid phone number"),
  body("installment.buyer.passport")
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage("Buyer passport is required and must be 5–20 characters"),
  handleValidationErrors,
];

// Legacy validation (kept for backward compatibility if needed)
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
  body("installment.buyer.phone")
    .if(body("boughtType").equals("Installment"))
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage("Please provide a valid phone number"),
  body("installment.buyer.passport")
    .if(body("boughtType").equals("Installment"))
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage("Buyer passport is required and must be 5–20 characters"),

  handleValidationErrors,
];

// Installment update validation (for editing existing installment info)
const validateInstallmentUpdate = [
  // Buyer name validation (optional, but if provided must be valid)
  body("buyer.name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Buyer name must be between 1 and 100 characters"),

  // Buyer phone validation (optional, but if provided must match phone format)
  body("buyer.phone")
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage("Please provide a valid phone number"),

  // Buyer email validation removed - email not required for installment buyers

  // Buyer passport validation (required if buyer is provided)
  body("buyer.passport")
    .optional()
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage("Buyer passport must be 5-20 characters"),

  // Down payment validation (optional, but if provided must be positive number)
  body("downPayment")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Down payment must be a positive number"),

  // Remaining amount validation (optional, but if provided must be positive number)
  body("remainingAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Remaining amount must be a positive number"),

  // Months validation (optional, but if provided must be positive integer)
  body("months")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Months must be at least 1"),

  // Start date validation (optional, but if provided must be valid ISO8601 date)
  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid start date"),

  // Monthly payment validation (optional, but if provided must be positive number)
  body("monthlyPayment")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Monthly payment must be a positive number"),

  handleValidationErrors,
];

// Installment payment validation (for adding payments)
const validateInstallmentPayment = [
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Payment amount must be a positive number"),

  body("paymentDate")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid payment date"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must be less than 500 characters"),

  handleValidationErrors,
];

// Installment monthly payment validation (with month tracking)
const validateInstallmentPaymentByMonth = [
  body("monthNumber")
    .isInt({ min: 1 })
    .withMessage("monthNumber must be at least 1"),
  body("paid")
    .isBoolean()
    .withMessage("paid flag must be true or false"),
  body("penaltyFee")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("penaltyFee must be zero or a positive number"),
  body("amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("amount must be zero or a positive number"),
  body("paymentDate")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid payment date"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must be less than 500 characters"),
  handleValidationErrors,
];

// Sale update validation (for editing existing sale info)
const validateSaleUpdate = [
  // Buyer name validation (optional, but if provided must be valid)
  body("buyer.name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Buyer name must be between 1 and 100 characters"),

  // Buyer phone validation (optional, but if provided must match phone format)
  body("buyer.phone")
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage("Please provide a valid phone number"),

  // Buyer email validation removed - email not required for installment buyers

  // Price validation (optional, but if provided must be positive number)
  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  // KiloAtSale validation (optional, but if provided must be positive number)
  body("kiloAtSale")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Kilometer at sale must be a positive number"),

  // SaleDate validation (optional, but if provided must be valid ISO8601 date)
  body("saleDate")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid sale date"),

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

// Repair array validation (for editCar)
const validateRepairsArray = [
  // Parse repairs if it's a JSON string (common with multipart/form-data)
  body("repairs")
    .optional()
    .customSanitizer((value) => {
      if (value === undefined || value === null) {
        return value;
      }
      // If it's a string, try to parse it as JSON
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return parsed;
        } catch (e) {
          // Return as-is if parsing fails, validation will catch it
          return value;
        }
      }
      return value;
    })
    .custom((value) => {
      // If repairs is provided, it must be an array
      if (value !== undefined && value !== null && !Array.isArray(value)) {
        throw new Error("Repairs must be an array");
      }
      return true;
    }),
  // Validate array items (only runs if repairs is an array)
  body("repairs.*.description")
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Each repair description must be between 1 and 500 characters"),
  body("repairs.*.repairDate")
    .optional()
    .isISO8601()
    .withMessage("Each repair date must be a valid ISO8601 date"),
  body("repairs.*.cost")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Each repair cost must be a positive number"),
  handleValidationErrors,
];

// Owner book transfer validation
const validateOwnerBookTransfer = [
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
  handleValidationErrors,
];

module.exports = {
  validateRegistration,
  validateUserCreation,
  validateUserUpdate,
  validateLogin,
  validateCarCreation,
  validateCarSale, // Legacy - kept for backward compatibility
  validatePaidSale, // New - for /api/car/:id/sell
  validateInstallmentSale, // New - for /api/car/:id/sell-installment
  validateInstallmentUpdate, // New - for /api/car/:id/edit-installment
  validateInstallmentPayment, // New - for /api/car/:id/installment/payment
  validateInstallmentPaymentByMonth, // New - for /api/car/:id/installment/monthly-payment
  validateOwnerBookTransfer, // New - for /api/car/:id/owner-book-transfer
  validateSaleUpdate,
  validateRepair,
  validateRepairsArray,
  handleValidationErrors,
};
