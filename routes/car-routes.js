// routes/carRoutes.js
const express = require("express");
const router = express.Router();
const carController = require("../controllers/car-controller");
const { protect } = require("../controllers/auth-controller");
const { validateCarCreation, validateCarSale, validateRepair } = require("../middleware/validation");

// Protect all car routes
router.use(protect);

// List + basic CRUD
router.get("/cars", carController.getAllCarsList);
router.get("/cars/available", carController.getAvailableCars);
router.get("/cars/sold", carController.getSoldCarsList);
router.get("/car/:id", carController.getCarById);
router.post("/create-car", validateCarCreation, carController.createCar);
router.put("/car/:id/sell", validateCarSale, carController.markAsSold);
router.post("/cars/:carId/repairs", validateRepair, carController.addRepair);
router.put("/car/:id/edit", carController.editCar);
router.put("/car/:id/edit-sale", carController.editSaleInfo);

module.exports = router;
