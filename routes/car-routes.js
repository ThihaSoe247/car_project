const express = require("express");
const router = express.Router();
const carController = require("../controllers/car-controller");
const multer = require("multer");
const { canViewProfit } = require("../middleware/authorization");

const { protect } = require("../controllers/auth-controller");

const upload = require("../cloud/upload");

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

// ===== PUBLIC/STAFF ACCESS =====
router.get("/cars", canViewCars, carController.getAllCarsList);
router.get("/cars/available", canViewCars, carController.getAvailableCars);
router.get("/cars/sold", canViewCars, carController.getSoldCarsList);
router.get("/car/:id", canViewCars, carController.getCarById);

// ===== ADMIN ONLY ACCESS =====
router.post(
  "/create-car",
  protect,
  canAddCarInfo,
  upload.array("images", 10), // ✅ goes directly to Cloudinary
  validateCarCreation,
  carController.createCar
);

router.put(
  "/car/:id/sell",
  protect,
  canMarkAsSold,
  validateCarSale,
  carController.markAsSold
);

router.put(
  "/car/:id/edit",
  protect,
  canEditCar,
  upload.array("images", 10), // ✅ goes directly to Cloudinary
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

router.get(
  "/analysis/profit",
  protect,
  canViewProfit, // ✅ Admin + Moderator only
  carController.getProfitAnalysis
);

module.exports = router;
