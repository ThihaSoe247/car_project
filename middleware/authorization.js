// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

// ===== MODERATOR PERMISSIONS (Account Management Only) =====
const canManageAccounts = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "Moderator") {
    return res.status(403).json({
      success: false,
      message: "Only Moderators can manage user accounts",
    });
  }
  next();
};

const canCreateAdminAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "Moderator") {
    return res.status(403).json({
      success: false,
      message: "Only Moderators can create Admin accounts",
    });
  }
  next();
};

// ===== ADMIN PERMISSIONS (Full System Access Except Account Management) =====
const canManageSystem = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "Admin") {
    return res.status(403).json({
      success: false,
      message: "Only Admins can perform this operation",
    });
  }
  next();
};

const canCreateCar = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!["Admin"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only Admins can create cars",
    });
  }
  next();
};
const canEditCar = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!["Admin"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only Admins can edit cars",
    });
  }
  next();
};

const canMarkAsSold = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!["Admin"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only Admins can mark cars as sold",
    });
  }
  next();
};

const canViewAllData = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!["Admin"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only Admins can view all data",
    });
  }
  next();
};

// ===== STAFF PERMISSIONS (Limited Access Without Authentication) =====
const canViewCars = (req, res, next) => {
  // Staff can view cars without authentication
  next();
};

const canAddCarInfo = (req, res, next) => {
  // Staff can add car information without authentication
  next();
};

// ===== PUBLIC ACCESS (No Authentication Required) =====
const publicAccess = (req, res, next) => {
  // Public access - no authentication required
  next();
};

module.exports = {
  authorize,
  // Moderator permissions
  canManageAccounts,
  canCreateAdminAccount,
  // Admin permissions
  canManageSystem,
  canCreateCar,
  canEditCar,
  canMarkAsSold,
  canViewAllData,
  // Staff permissions (no auth required)
  canViewCars,
  canAddCarInfo,
  // Public access
  publicAccess,
};
