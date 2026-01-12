const express = require("express");
const router = express.Router();
const carController = require("../controllers/car-controller");
const multer = require("multer");
const { canViewProfit } = require("../middleware/authorization");

const { protect } = require("../controllers/auth-controller");

const upload = require("../cloud/upload");

const {
  validateCarCreation,
  validatePaidSale,
  validateInstallmentSale,
  validateInstallmentUpdate,
  validateInstallmentPayment,
  validateInstallmentPaymentByMonth,
  validateOwnerBookTransfer,
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
  upload.array("images", 10),
  validateCarCreation, // ✅ Validate BEFORE file upload
  carController.createCar
);

// Mark car as sold via Paid payment
router.put(
  "/car/:id/sell",
  protect,
  canMarkAsSold,
  validatePaidSale,
  carController.markAsPaid
);

// Mark car as sold via Installment payment
router.put(
  "/car/:id/sell-installment",
  protect,
  canMarkAsSold,
  validateInstallmentSale,
  carController.markAsInstallment
);

router.put(
  "/car/:id/edit",
  protect,
  canEditCar,
  upload.array("images", 10),
  validateRepairsArray, // ✅ Validate BEFORE file uploadd after validation
  carController.editCar
);

router.put(
  "/car/:id/edit-sale",
  protect,
  canEditCar,
  validateSaleUpdate,
  carController.editSaleInfo
);

// Edit installment information, like customer infos and car infos, not payments yet
router.put(
  "/car/:id/edit-installment",
  protect,
  canEditCar,
  validateInstallmentUpdate,
  carController.editInstallmentInfo
);

// Add payment to installment, change to the following route, still keep this one for backward compatibility
router.post(
  "/car/:id/installment/payment",
  protect,
  canEditCar,
  validateInstallmentPayment,
  carController.addInstallmentPayment
);

// Upsert monthly installment payment (with penalty tracking)
router.post(
  "/car/:id/installment/monthly-payment",
  protect,
  canEditCar,
  validateInstallmentPaymentByMonth,
  carController.upsertInstallmentPaymentByMonth
);

router.delete("/car/:id", protect, canEditCar, carController.deleteCar);

router.post(
  "/cars/:id/repairs",
  protect,
  canEditCar,
  validateRepair,
  carController.addRepair
);

// Get installment details for a specific car
router.get(
  "/car/:id/installment",
  protect,
  canViewCarsInternal,
  carController.getCarInstallmentDetails
);

router.get(
  "/cars/sold/installment",
  protect,
  canViewCarsInternal,
  carController.getSoldCarsByInstallment
);

//Old route for analysis/profit, now it's separated into 2 separated routes
router.get(
  "/analysis/profit",
  protect,
  canViewProfit, // ✅ Admin + Moderator only
  carController.getProfitAnalysis
);

router.get(
  "/analysis/profit/paid",
  protect,
  canViewProfit, // ✅ Admin + Moderator only
  carController.getPaidProfitAnalysis
);

router.get(
  "/analysis/profit/installment",
  protect,
  canViewProfit, // ✅ Admin + Moderator only
  carController.getInstallmentProfitAnalysis
);

router.put(
  "/car/:id/owner-book-transfer",
  protect,
  canEditCar,
  validateOwnerBookTransfer,
  carController.ownerBookTransfer
);

module.exports = router;
