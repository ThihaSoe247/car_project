// routes/carRoutes.js
const express = require("express");
const router = express.Router();
const carController = require("../controllers/car-controller");

// List + basic CRUD// routes/carRoutes.js
router.get("/cars", carController.getAllCarsList);
router.get("/cars/available", carController.getAvailableCars);
router.get("/cars/sold", carController.getSoldCarsList);
router.get("/car/:id", carController.getCarById);
router.post("/create-car", carController.createCar);
router.put("/car/:id/sell", carController.markAsSold);
router.post("/cars/:carId/repairs", carController.addRepair);
router.put("/car/:id/edit", carController.editCar);
router.put("/car/:id/edit-sale", carController.editSaleInfo);

module.exports = router;
