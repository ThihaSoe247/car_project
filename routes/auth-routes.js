const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth-controller");
const { validateRegistration, validateLogin } = require("../middleware/validation");
const { protect } = require("../controllers/auth-controller");

// Public routes
router.post("/register", validateRegistration, authController.register);
router.post("/login", validateLogin, authController.login);

// Protected routes
router.get("/me", protect, authController.getMe);
router.put("/profile", protect, authController.updateProfile);

module.exports = router;
