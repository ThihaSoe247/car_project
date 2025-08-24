// routes/carRoutes.js
const express = require("express");
const router = express.Router();
const carController = require("../controllers/car-controller");
const { protect } = require("../controllers/auth-controller");
const { validateCarCreation, validateCarSale, validateRepair } = require("../middleware/validation");
const { 
  canCreateCar, 
  canEditCar, 
  canMarkAsSold, 
  canViewAllData,
  canViewCars,
  canAddCarInfo,
  publicAccess
} = require("../middleware/authorization");

// ===== PUBLIC/STAFF ACCESS (No Authentication Required) =====
// Staff can view cars without authentication
router.get("/cars", canViewCars, carController.getAllCarsList);
router.get("/cars/available", canViewCars, carController.getAvailableCars);
router.get("/cars/sold", canViewCars, carController.getSoldCarsList);
router.get("/car/:id", canViewCars, carController.getCarById);

// Staff can add basic car information without authentication
router.post("/create-car", canAddCarInfo, validateCarCreation, carController.createCar);

// ===== ADMIN ONLY ACCESS (Authentication Required) =====
// All car management operations require Admin authentication
router.put("/car/:id/sell", protect, canMarkAsSold, validateCarSale, carController.markAsSold);
router.put("/car/:id/edit", protect, canEditCar, carController.editCar);
router.put("/car/:id/edit-sale", protect, canEditCar, carController.editSaleInfo);
router.post("/cars/:carId/repairs", protect, canEditCar, validateRepair, carController.addRepair);

module.exports = router;
