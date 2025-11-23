const User = require("../model/User");
const mongoose = require("mongoose");

// Input sanitization for MongoDB queries
const sanitizeId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid user ID format");
  }
  return id;
};

const userController = {
  // Get all users (Moderators only)
  getAllUsers: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip = (page - 1) * limit;

      // Build filter
      const filter = {};

      if (req.query.role) {
        filter.role = req.query.role;
      }

      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === "true";
      }

      const [users, total] = await Promise.all([
        User.find(filter)
          .select("-password")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to fetch users:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get single user by ID (Moderators only)
  getUserById: async (req, res) => {
    try {
      const userId = sanitizeId(req.params.id);

      const user = await User.findById(userId).select("-password").lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Create Admin user (Moderators only)
  createAdminUser: async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      // Create Admin user
      const adminUser = new User({
        name,
        email,
        password,
        role: "Admin",
        // createdBy: req.user.userId
      });

      await adminUser.save();

      // Remove password from response
      adminUser.password = undefined;

      return res.status(201).json({
        success: true,
        message: "Admin user created successfully",
        data: adminUser,
      });
    } catch (error) {
      console.error("Error creating admin user:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to create admin user",
      });
    }
  },

  // Create regular user (Moderators only)
  createUser: async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      // Validate role - Moderators can only create Admin users
      if (role === "Moderator") {
        return res.status(403).json({
          success: false,
          message: "Moderators cannot create other Moderator accounts",
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      // Create user
      const user = new User({
        name,
        email,
        password,
        role: role || "Admin",
        // createdBy: req.user.userId
      });

      await user.save();

      // Remove password from response
      user.password = undefined;

      return res.status(201).json({
        success: true,
        message: "User created successfully",
        data: user,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to create user",
      });
    }
  },

  // Update user (Moderators only)
  updateUser: async (req, res) => {
    try {
      const userId = sanitizeId(req.params.id);
      const { name, email, role, isActive } = req.body;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent Moderators from updating other Moderators
      if (user.role === "Moderator" && req.user.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Cannot modify other Moderator accounts",
        });
      }

      // Check if email is being changed and if it already exists
      if (email && email !== user.email) {
        const existingUser = await User.findOne({
          email,
          _id: { $ne: userId },
        });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Email already in use",
          });
        }
      }

      // Update user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { name, email, role, isActive },
        { new: true, runValidators: true }
      ).select("-password");

      return res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update user",
      });
    }
  },

  // Toggle user status (Moderators only)
  toggleUserStatus: async (req, res) => {
    try {
      const userId = sanitizeId(req.params.id);

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent Moderators from deactivating themselves
      if (req.user.userId === userId) {
        return res.status(403).json({
          success: false,
          message: "Cannot deactivate your own account",
        });
      }

      // Toggle status
      user.isActive = !user.isActive;
      await user.save();

      return res.status(200).json({
        success: true,
        message: `User ${
          user.isActive ? "activated" : "deactivated"
        } successfully`,
        data: {
          id: user._id,
          isActive: user.isActive,
        },
      });
    } catch (error) {
      console.error("Error toggling user status:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update user status",
      });
    }
  },

  // Delete user (Moderators only)
  deleteUser: async (req, res) => {
    try {
      const userId = sanitizeId(req.params.id);

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent Moderators from deleting themselves
      if (req.user.userId === userId) {
        return res.status(403).json({
          success: false,
          message: "Cannot delete your own account",
        });
      }

      // Prevent deleting the last Moderator
      if (user.role === "Moderator") {
        const moderatorCount = await User.countDocuments({
          role: "Moderator",
          isActive: true,
        });
        if (moderatorCount <= 1) {
          return res.status(403).json({
            success: false,
            message: "Cannot delete the last active Moderator",
          });
        }
      }

      await User.findByIdAndDelete(userId);

      return res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to delete user",
      });
    }
  },
};

module.exports = userController;
