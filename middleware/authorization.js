// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
};

// Specific permission checks
const canCreateCar = (req, res, next) => {
  if (!['Admin', 'Staff'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only Admins and Staff can create cars' 
    });
  }
  next();
};

const canEditCar = (req, res, next) => {
  if (!['Admin', 'Staff'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only Admins and Staff can edit cars' 
    });
  }
  next();
};

const canMarkAsSold = (req, res, next) => {
  if (!['Admin', 'Staff'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only Admins and Staff can mark cars as sold' 
    });
  }
  next();
};

const canViewAllData = (req, res, next) => {
  if (!['Admin'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only Admins can view all data' 
    });
  }
  next();
};

module.exports = {
  authorize,
  canCreateCar,
  canEditCar,
  canMarkAsSold,
  canViewAllData
};
