const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth-controller");
const {
  validateRegistration,
  validateLogin,
} = require("../middleware/validation");

// Public routes
router.post("/register", validateRegistration, authController.register);
router.post("/login", validateLogin, authController.login);

// Protected routes
router.get("/me", authController.getMe);
router.put("/profile", authController.updateProfile);

module.exports = router;
