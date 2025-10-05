// controllers/car-controller.js
const Car = require("../model/Car");
const mongoose = require("mongoose");
const fs = require("fs");
const { cloudinary } = require("../cloud/cloudinary");
const { streamUpload } = require("../utils/cloudinary");

// Safe date parser
const toDate = (v) => {
  if (!v) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Input sanitization for MongoDB queries
const sanitizeId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid car ID format");
  }
  return id;
};

// Pagination limits
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

// Default user ID for Staff operations (when no authentication)
const STAFF_USER_ID = new mongoose.Types.ObjectId("000000000000000000000000");

const carController = {
  createCar: async (req, res) => {
    try {
      const {
        licenseNo,
        brand,
        year,
        gear,
        color,
        enginePower,
        purchasePrice,
        priceToSell,
        purchaseDate,
        kilo,
        wheelDrive,
      } = req.body;

      const newCar = new Car({
        licenseNo,
        brand,
        year: parseInt(year),
        gear,
        color,
        enginePower,
        purchasePrice: parseFloat(purchasePrice),
        priceToSell: parseFloat(priceToSell),
        purchaseDate: new Date(purchaseDate),
        kilo: parseFloat(kilo),
        wheelDrive,
        images: [],
      });

      await newCar.save();

      // ✅ Upload images from memory
      let imageObjs = [];

      if (req.files && req.files.length > 0) {
        const uploadedImages = await Promise.all(
          req.files.map((file) =>
            streamUpload(file.buffer, `car-showroom/${newCar._id}`)
          )
        );

        imageObjs = uploadedImages.map((img) => ({
          url: img.secure_url,
          public_id: img.public_id,
        }));
      }

      newCar.images = imageObjs;
      await newCar.save();

      res.status(201).json({ success: true, data: newCar });
    } catch (err) {
      console.error("Error creating car:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
  // Get all cars with pagination and filtering
  getAllCarsList: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(
        parseInt(req.query.limit) || DEFAULT_LIMIT,
        MAX_LIMIT
      );
      const skip = (page - 1) * limit;

      // Build filter based on query parameters
      const filter = {};

      if (req.query.brand) {
        filter.brand = new RegExp(req.query.brand, "i");
      }

      if (req.query.year) {
        filter.year = parseInt(req.query.year);
      }

      if (req.query.gear) {
        filter.gear = req.query.gear;
      }

      if (req.query.wheelDrive) {
        filter.wheelDrive = req.query.wheelDrive;
      }

      const [cars, total] = await Promise.all([
        Car.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          // .populate("createdBy", "name email")
          // .populate("updatedBy", "name email")
          .lean({ virtuals: true }),
        Car.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: cars,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to fetch cars list:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get available cars only
  getAvailableCars: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(
        parseInt(req.query.limit) || DEFAULT_LIMIT,
        MAX_LIMIT
      );
      const skip = (page - 1) * limit;

      const [cars, total] = await Promise.all([
        Car.find({ isAvailable: true })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          // .populate("createdBy", "name email")
          .lean({ virtuals: true }),
        Car.countDocuments({ isAvailable: true }),
      ]);

      return res.status(200).json({
        success: true,
        data: cars,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to fetch available cars:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  getSoldCarsList: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(
        parseInt(req.query.limit) || DEFAULT_LIMIT,
        MAX_LIMIT
      );
      const skip = (page - 1) * limit;

      const filter = {
        isAvailable: false,
        sale: { $exists: true, $ne: null },
      };

      // Date range filtering for sold cars
      if (req.query.from || req.query.to) {
        filter["sale.date"] = {};
        if (req.query.from) {
          const fromDate = toDate(req.query.from);
          if (fromDate) filter["sale.date"].$gte = fromDate;
        }
        if (req.query.to) {
          const toDate = toDate(req.query.to);
          if (toDate) filter["sale.date"].$lte = toDate;
        }
      }

      // Additional filters
      if (req.query.brand) {
        filter.brand = new RegExp(req.query.brand, "i");
      }

      if (req.query.year) {
        filter.year = parseInt(req.query.year);
      }

      const [cars, total] = await Promise.all([
        Car.find(filter)
          .sort({ "sale.date": -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Car.countDocuments(filter),
      ]);

      // Transform cars to include virtuals and profit calculation
      const carsWithProfit = cars.map((car) => {
        const carObj = car.toObject({ virtuals: true });

        // Ensure profit is calculated (fallback if virtual doesn't work)
        if (!carObj.profit && car.sale?.price && car.purchasePrice) {
          const totalRepairCost = (car.repairs || []).reduce(
            (sum, r) => sum + (r.cost || 0),
            0
          );
          carObj.profit =
            car.sale.price - (car.purchasePrice + totalRepairCost);
          carObj.totalRepairCost = totalRepairCost;
        }

        return carObj;
      });

      return res.status(200).json({
        success: true,
        data: carsWithProfit,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to fetch sold cars list:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  // DELETE a car by ID (Admin only)
  deleteCar: async (req, res, next) => {
    try {
      const car = await Car.findById(req.params.id);

      if (!car) {
        return res.status(404).json({
          success: false,
          error: "Car not found",
        });
      }

      await car.deleteOne();

      res.status(200).json({
        success: true,
        message: "Car deleted successfully",
      });
    } catch (err) {
      next(err);
    }
  },
  markAsSold: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
      const { boughtType } = req.body;

      if (!boughtType || !["Paid", "Installment"].includes(boughtType)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "boughtType must be either 'Paid' or 'Installment'",
        });
      }

      const car = await Car.findById(carId).session(session);
      if (!car) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Car not found",
        });
      }

      if (!car.isAvailable) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Car is already marked as sold",
        });
      }

      let finalSalePrice = 0;

      // === Paid ===
      if (boughtType === "Paid") {
        const { sale } = req.body;
        if (
          !sale ||
          !sale.price ||
          !sale.soldDate ||
          !sale.kiloAtSale ||
          !sale.buyer?.name
        ) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message:
              "Required: sale.price, sale.soldDate, sale.kiloAtSale, sale.buyer.name",
          });
        }

        car.markAsPaid({
          price: Number(sale.price),
          date: toDate(sale.soldDate),
          kiloAtSale: Number(sale.kiloAtSale),
          buyer: sale.buyer,
          updatedBy: req.user.userId,
        });

        finalSalePrice = Number(sale.price);

        // === Installment ===
      } else if (boughtType === "Installment") {
        const { installment } = req.body;
        if (
          !installment ||
          !installment.downPayment ||
          !installment.remainingAmount ||
          !installment.months ||
          !installment.buyer?.name
        ) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message:
              "Required: installment.downPayment, installment.remainingAmount, installment.months, installment.buyer.name",
          });
        }

        car.markAsInstallment({
          downPayment: Number(installment.downPayment),
          remainingAmount: Number(installment.remainingAmount),
          months: Number(installment.months),
          buyer: installment.buyer,
          startDate: installment.startDate
            ? toDate(installment.startDate)
            : new Date(),
          updatedBy: req.user.userId,
        });

        // Total price = downPayment + remaining
        finalSalePrice =
          Number(installment.downPayment) + Number(installment.remainingAmount);
      }

      // === Calculate profit ===
      const totalRepairCost = (car.repairs || []).reduce(
        (sum, r) => sum + (r.cost || 0),
        0
      );
      car.profit = finalSalePrice - (car.purchasePrice + totalRepairCost);
      car.totalRepairCost = totalRepairCost;

      const updated = await car.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: `Car marked as sold via ${boughtType}`,
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error marking car as sold:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update car",
      });
    } finally {
      session.endSession();
    }
  },

  // Get single car by ID
  getCarById: async (req, res) => {
    try {
      const carId = sanitizeId(req.params.id);

      const car = await Car.findById(carId)
        // .populate("createdBy", "name email")
        // .populate("updatedBy", "name email")
        .lean({ virtuals: true });

      if (!car) {
        return res.status(404).json({
          success: false,
          message: "Car not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: car,
      });
    } catch (error) {
      console.error("Error fetching car details:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Add repair record
  addRepair: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.carId);
      const { description, repairDate, cost } = req.body;

      if (!description || cost == null) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Description and cost are required",
        });
      }

      const car = await Car.findById(carId).session(session);
      if (!car) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Car not found",
        });
      }

      car.repairs.push({
        description,
        repairDate: toDate(repairDate) || new Date(),
        cost: Number(cost),
      });

      car.updatedBy = req.user.userId;

      const updatedCar = await car.save({ session });
      await session.commitTransaction();

      return res.status(201).json({
        success: true,
        message: "Repair added successfully",
        car: updatedCar.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error adding repair:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to add repair",
      });
    } finally {
      session.endSession();
    }
  },

  editCar: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
      const car = await Car.findById(carId).session(session);
      if (!car) {
        await session.abortTransaction();
        return res
          .status(404)
          .json({ success: false, message: "Car not found" });
      }

      // Updates
      const updates = req.body;

      // Handle images
      let finalImages = [];

      // 1. Keep only images still selected on frontend
      if (updates.existingImages) {
        const keep = Array.isArray(updates.existingImages)
          ? updates.existingImages
          : [updates.existingImages];

        const toDelete = car.images.filter(
          (img) => !keep.includes(img.public_id)
        );

        // Delete from Cloudinary
        await Promise.all(
          toDelete.map((img) => cloudinary.uploader.destroy(img.public_id))
        );

        finalImages = car.images.filter((img) => keep.includes(img.public_id));
      }

      // 2. Upload new files
      if (req.files && req.files.length > 0) {
        const uploaded = await Promise.all(
          req.files.map((file) =>
            cloudinary.uploader.upload(file.path, {
              folder: `car-showroom/${car._id}`,
              use_filename: true,
              unique_filename: true,
            })
          )
        );

        finalImages.push(
          ...uploaded.map((img) => ({
            url: img.secure_url,
            public_id: img.public_id,
          }))
        );
      }

      // Save final images
      car.images = finalImages;

      // Apply other fields
      const allowedFields = [
        "brand",
        "year",
        "enginePower",
        "gear",
        "color",
        "kilo",
        "wheelDrive",
        "purchaseDate",
        "purchasePrice",
        "priceToSell",
        "licenseNo",
      ];
      allowedFields.forEach((field) => {
        if (updates[field] !== undefined) {
          car[field] = updates[field];
        }
      });

      const updated = await car.save({ session });
      await session.commitTransaction();

      res.status(200).json({
        success: true,
        message: "Car updated successfully",
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error editing car:", error);
      res.status(500).json({ success: false, message: "Failed to edit car" });
    } finally {
      session.endSession();
    }
  },

  // Get sold cars by installment
  getSoldCarsByInstallment: async (req, res, next) => {
    try {
      const cars = await Car.find({
        isAvailable: false,
        boughtType: "Installment",
      });

      res.status(200).json({
        success: true,
        count: cars.length,
        data: cars,
      });
    } catch (err) {
      next(err);
    }
  },

  // Edit sale information
  editSaleInfo: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
      const car = await Car.findById(carId).session(session);

      if (!car || !car.sale) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Car not sold or not found",
        });
      }

      const { buyer, kiloAtSale, saleDate, price } = req.body;

      if (buyer?.name) car.sale.buyer.name = buyer.name;
      if (buyer?.phone) car.sale.buyer.phone = buyer.phone;
      if (buyer?.email) car.sale.buyer.email = buyer.email;
      if (kiloAtSale != null) car.sale.kiloAtSale = Number(kiloAtSale);
      if (saleDate) car.sale.date = toDate(saleDate);
      if (price != null) car.sale.price = Number(price);

      car.updatedBy = req.user.userId;

      const updated = await car.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Sale info updated successfully",
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Failed to edit sale info:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to edit sale info",
      });
    } finally {
      session.endSession();
    }
  },
  // controllers/car-controller.js
  // controllers/car-controller.js

  getProfitAnalysis: async (req, res) => {
    try {
      const { period } = req.query;
      const now = new Date();
      let startDate;

      if (period === "monthly") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === "6months") {
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      } else if (period === "yearly") {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Invalid period" });
      }

      // ✅ Filter by soldOutDate
      const cars = await Car.find({
        soldOutDate: { $gte: startDate, $lte: now },
      });

      const report = cars.map((car) => {
        const totalRepairs = car.repairs.reduce((sum, r) => sum + r.cost, 0);
        const soldPrice = car.sale?.price || car.resellPrice || car.priceToSell;

        const profit = soldPrice - car.purchasePrice - totalRepairs;

        return {
          licenseNo: car.licenseNo,
          brand: car.brand,
          purchasePrice: car.purchasePrice,
          soldPrice,
          totalRepairs,
          profit,
          soldOutDate: car.soldOutDate,
        };
      });

      const totalProfit = report.reduce((sum, r) => sum + r.profit, 0);

      res.json({ success: true, totalProfit, cars: report });
    } catch (err) {
      console.error("Error generating profit analysis:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to generate report" });
    }
  },
};

module.exports = carController;
