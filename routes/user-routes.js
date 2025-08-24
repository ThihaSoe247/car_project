const express = require("express");
const router = express.Router();
const userController = require("../controllers/user-controller");
const { protect } = require("../controllers/auth-controller");
const { validateUserCreation, validateUserUpdate } = require("../middleware/validation");
const { canManageAccounts, canCreateAdminAccount } = require("../middleware/authorization");

// ===== MODERATOR ONLY ROUTES (Account Management) =====
// All routes require authentication and Moderator role

// Get all users (Moderators only)
router.get("/users", protect, canManageAccounts, userController.getAllUsers);

// Get single user by ID (Moderators only)
router.get("/users/:id", protect, canManageAccounts, userController.getUserById);

// Create Admin account (Moderators only)
router.post("/users/admin", protect, canCreateAdminAccount, validateUserCreation, userController.createAdminUser);

// Create regular user account (Moderators only)
router.post("/users", protect, canManageAccounts, validateUserCreation, userController.createUser);

// Update user account (Moderators only)
router.put("/users/:id", protect, canManageAccounts, validateUserUpdate, userController.updateUser);

// Deactivate/Activate user account (Moderators only)
router.patch("/users/:id/status", protect, canManageAccounts, userController.toggleUserStatus);

// Delete user account (Moderators only)
router.delete("/users/:id", protect, canManageAccounts, userController.deleteUser);

module.exports = router;
