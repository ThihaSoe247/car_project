// routes/carRoutes.js
const express = require("express");
const router = express.Router();
const carController = require("../controllers/car-controller");
const { protect } = require("../controllers/auth-controller");
const { validateCarCreation, validateCarSale, validateRepair } = require("../middleware/validation");
const { canCreateCar, canEditCar, canMarkAsSold, canViewAllData } = require("../middleware/authorization");

// Protect all car routes
router.use(protect);

// Read operations - all authenticated users can view
router.get("/cars", carController.getAllCarsList);
router.get("/cars/available", carController.getAvailableCars);
router.get("/cars/sold", carController.getSoldCarsList);
router.get("/car/:id", carController.getCarById);

// Create operations - require proper permissions
router.post("/create-car", canCreateCar, validateCarCreation, carController.createCar);

// Update operations - require proper permissions
router.put("/car/:id/sell", canMarkAsSold, validateCarSale, carController.markAsSold);
router.put("/car/:id/edit", canEditCar, carController.editCar);
router.put("/car/:id/edit-sale", canEditCar, carController.editSaleInfo);

// Repair operations - require proper permissions
router.post("/cars/:carId/repairs", canEditCar, validateRepair, carController.addRepair);

module.exports = router;
