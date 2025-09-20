// routes/car-routes.js
const express = require("express");
const router = express.Router();
const carController = require("../controllers/car-controller");
const multer = require("multer");
const { storage } = require("../cloud/cloudinary");

// ✅ Import protect from auth-controller
const { protect } = require("../controllers/auth-controller");

const upload = multer({ storage });

const {
  validateCarCreation,
  validateCarSale,
  validateRepair,
} = require("../middleware/validation");

const {
  canCreateCar,
  canEditCar,
  canMarkAsSold,
  canViewAllData,
  canViewCars,
  canAddCarInfo,
  publicAccess,
} = require("../middleware/authorization");

// ===== PUBLIC/STAFF ACCESS (No Authentication Required) =====
router.get("/cars", canViewCars, carController.getAllCarsList);
router.get("/cars/available", canViewCars, carController.getAvailableCars);
router.get("/cars/sold", canViewCars, carController.getSoldCarsList);
router.get("/car/:id", canViewCars, carController.getCarById);

// ===== STAFF ACCESS (No Auth Required to Add Basic Car Info) =====
router.post(
  "/create-car",
  canAddCarInfo,
  upload.array("images", 20), // multer handles up to 20 files
  validateCarCreation,
  carController.createCar
);

// ===== ADMIN ONLY ACCESS (Authentication + Role Check Required) =====
router.put(
  "/car/:id/sell",
  protect, // 🔑 verify JWT & attach req.user
  canMarkAsSold, // 🔑 check Admin role
  validateCarSale,
  carController.markAsSold
);

router.put(
  "/car/:id/edit",
  protect, // 🔑 must login
  canEditCar, // 🔑 must be Admin
  carController.editCar
);

router.put(
  "/car/:id/edit-sale",
  protect,
  canEditCar,
  carController.editSaleInfo
);

router.delete("/car/:id", protect, canEditCar, carController.deleteCar);

router.post(
  "/cars/:carId/repairs",
  protect,
  canEditCar,
  validateRepair,
  carController.addRepair
);

router.get(
  "/cars/sold/installment",
  canViewCars,
  carController.getSoldCarsByInstallment
);

module.exports = router;
