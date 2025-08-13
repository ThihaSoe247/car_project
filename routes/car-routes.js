// routes/carRoutes.js

const express = require("express");
const router = express.Router();
const carController = require("../controllers/car-controller");

// Optional: add auth middleware if needed
// const { verifyUser } = require("../middlewares/authMiddleware");

router.get("/cars", carController.getAllCarsList);
router.post("/create-car", carController.createCar);
router.put("/car/:id/sell", carController.markAsSold);
router.get("/car/:id", carController.getCarById);

module.exports = router;
