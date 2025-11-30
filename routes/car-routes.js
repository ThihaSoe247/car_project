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
  validateSaleUpdate,
  validateRepair,
  validateRepairsArray,
} = require("../middleware/validation");

const {
  //canCreateCar,
  canEditCar,
  canMarkAsSold,
  //canViewAllData,
  //canViewCars,
  canViewCarsInternal,
  canAddCarInfo,
  publicAccess,
} = require("../middleware/authorization");

// ===== PUBLIC ACCESS (No Authentication, No Buyer Data) =====
router.get("/public/cars", publicAccess, carController.getPublicCarList);
router.get("/public/cars/available", publicAccess, carController.getPublicAvailableCars);
router.get("/public/car/:id", publicAccess, carController.getPublicCarById);

// ===== INTERNAL ACCESS (Authentication Required - Full Data) =====
router.get("/cars", protect, canViewCarsInternal, carController.getAllCarsList);
router.get("/cars/available", protect, canViewCarsInternal, carController.getAvailableCars);
router.get("/cars/sold", protect, canViewCarsInternal, carController.getSoldCarsList);
router.get("/car/:id", protect, canViewCarsInternal, carController.getCarById);

// ===== ADMIN ONLY ACCESS =====
router.post(
  "/create-car",
  protect,
  canAddCarInfo,
  validateCarCreation, // ✅ Validate BEFORE file upload
  upload.array("images", 10), // ✅ Upload after validation
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
  validateRepairsArray, // ✅ Validate BEFORE file upload
  upload.array("images", 10), // ✅ Upload after validation
  carController.editCar
);

router.put(
  "/car/:id/edit-sale",
  protect,
  canEditCar,
  validateSaleUpdate,
  carController.editSaleInfo
);

router.delete("/car/:id", protect, canEditCar, carController.deleteCar);

router.post(
  "/cars/:id/repairs",
  protect,
  canEditCar,
  validateRepair,
  carController.addRepair
);

router.get(
  "/cars/sold/installment",
  protect,
  canViewCarsInternal,
  carController.getSoldCarsByInstallment
);

router.get(
  "/analysis/profit",
  protect,
  canViewProfit, // ✅ Admin + Moderator only
  carController.getProfitAnalysis
);

module.exports = router;
