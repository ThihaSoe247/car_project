// controllers/car-controller.js
const Car = require("../model/Car");
const mongoose = require("mongoose");
const fs = require("fs");
const { cloudinary, streamUpload } = require("../cloud/cloudinary");

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

const carController = {
  createCar: async (req, res) => {
    try {
      const {
        licenseNo,
        brand,
        model,
        year,
        gear,
        color,
        enginePower,
        purchasePrice,
        priceToSell,
        purchaseDate,
        kilo,
        wheelDrive,
        repairs,
      } = req.body;

      // Handle repairs array (parse JSON string if needed, validate and transform)
      let validatedRepairs = [];
      if (repairs !== undefined && repairs !== null) {
        // Parse if it's a JSON string (fallback for edge cases)
        let repairsArray = repairs;
        if (typeof repairs === "string") {
          try {
            repairsArray = JSON.parse(repairs);
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: "Invalid repairs JSON format",
            });
          }
        }

        // Validate that it's an array
        if (!Array.isArray(repairsArray)) {
          return res.status(400).json({
            success: false,
            message: "Repairs must be an array",
          });
        }

        // Validate and transform each repair entry
        try {
          validatedRepairs = repairsArray.map((repair, index) => {
            // Validate required fields
            if (!repair.description || repair.cost == null) {
              throw new Error(`Repair at index ${index} is missing required fields (description, cost)`);
            }

            // Transform and validate
            return {
              description: String(repair.description).trim(),
              repairDate: toDate(repair.repairDate) || new Date(),
              cost: Number(repair.cost),
            };
          });

          // Validate cost is not NaN and is positive
          const invalidRepairs = validatedRepairs.filter(r => isNaN(r.cost) || r.cost < 0);
          if (invalidRepairs.length > 0) {
            return res.status(400).json({
              success: false,
              message: "Invalid repair cost values detected",
            });
          }
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: error.message || "Invalid repairs data",
          });
        }
      }

      // ✅ Upload images from memory FIRST (before creating car)
      // This ensures we only create the car if images upload successfully
      let imageObjs = [];
      let uploadedImageIds = []; // Track uploaded images for cleanup on failure

      // Debug: Log file information
      console.log("Files received:", req.files ? req.files.length : 0);
      if (req.files && req.files.length > 0) {
        console.log("Processing", req.files.length, "image(s)");
      }

      if (req.files && req.files.length > 0) {
        try {
          const uploadedImages = await Promise.all(
            req.files.map((file) =>
              streamUpload(file.buffer, `car-showroom`)
            )
          );

          imageObjs = uploadedImages.map((img) => ({
            url: img.secure_url,
            public_id: img.public_id,
          }));
          uploadedImageIds = imageObjs.map((img) => img.public_id);
          
          console.log("Successfully uploaded", imageObjs.length, "image(s)");
        } catch (uploadError) {
          // Clean up any images that were successfully uploaded before the failure
          // Note: Promise.all fails fast, so this cleanup handles partial uploads
          console.error("Error uploading images:", uploadError);
          // If upload fails, imageObjs will be empty, so no cleanup needed
          throw new Error("Failed to upload images: " + uploadError.message);
        }
      } else {
        console.log("No images provided or req.files is empty");
      }

      // ✅ Create car with images in single save operation
      // This prevents the double-save issue and ensures atomicity
      try {
        console.log("Creating car with", imageObjs.length, "image(s)");
        console.log("Image objects:", JSON.stringify(imageObjs, null, 2));
        
        const newCar = new Car({
          licenseNo: licenseNo?.trim().toUpperCase(),
          brand: brand?.trim(),
          model: model?.trim(),
          year: parseInt(year),
          gear,
          color: color?.trim(),
          enginePower: enginePower?.trim(),
          purchasePrice: parseFloat(purchasePrice),
          priceToSell: parseFloat(priceToSell),
          purchaseDate: new Date(purchaseDate),
          kilo: parseFloat(kilo),
          wheelDrive,
          repairs: validatedRepairs,
        });

        // ✅ Explicitly set images array to ensure it's saved
        // Setting it after object creation ensures Mongoose properly tracks and saves the images field
        newCar.images = imageObjs;
        
        // Mark images as modified to ensure they're saved (even for new documents)
        newCar.markModified('images');

        await newCar.save();
        
        // Reload the car from database to ensure we have the latest data
        const savedCar = await Car.findById(newCar._id);
        
        // Ensure images are included in the response
        const carData = savedCar.toObject({ virtuals: true });
        console.log("Car created successfully with", carData.images?.length || 0, "image(s) in database");
        if (carData.images && carData.images.length > 0) {
          console.log("Image URLs:", carData.images.map(img => img.url));
        } else {
          console.warn("WARNING: Car saved but images array is empty or missing!");
        }

        res.status(201).json({ success: true, data: carData });
      } catch (saveError) {
        // ✅ Clean up uploaded images if car creation fails
        if (uploadedImageIds.length > 0) {
          console.error("Car creation failed, cleaning up uploaded images");
          await Promise.all(
            uploadedImageIds.map((publicId) =>
              cloudinary.uploader.destroy(publicId).catch((err) => {
                // Log but don't fail - cleanup errors are non-critical
                console.error(`Failed to delete image ${publicId}:`, err);
              })
            )
          );
        }
        throw saveError;
      }
    } catch (err) {
      console.error("Error creating car:", err);
      res.status(500).json({ success: false, message: err.message || "Failed to create car" });
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
        $or: [
          { sale: { $exists: true, $ne: null } },
          { installment: { $exists: true, $ne: null } },
        ],
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
      const carId = sanitizeId(req.params.id);
      const car = await Car.findById(carId);

      if (!car) {
        return res.status(404).json({
          success: false,
          message: "Car not found",
        });
      }

      // Delete all images from Cloudinary before deleting car
      if (car.images && car.images.length > 0) {
        await Promise.all(
          car.images.map((img) =>
            cloudinary.uploader
              .destroy(img.public_id)
              .catch((err) => {
                // Log error but don't fail the deletion
                console.error(
                  `Failed to delete Cloudinary image ${img.public_id}:`,
                  err
                );
              })
          )
        );
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
          !sale.buyer?.name ||
          !sale.buyer?.passport
        ) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message:
              "Required: sale.price, sale.soldDate, sale.kiloAtSale, sale.buyer.name, sale.buyer.passport",
          });
        }

        // ✅ Validate number conversions to prevent NaN
        const salePrice = Number(sale.price);
        const kiloAtSaleNum = Number(sale.kiloAtSale);
        
        if (isNaN(salePrice) || salePrice <= 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "sale.price must be a valid positive number",
          });
        }

        if (isNaN(kiloAtSaleNum) || kiloAtSaleNum < 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "sale.kiloAtSale must be a valid non-negative number",
          });
        }

        // ✅ Validate date is not null
        const saleDate = toDate(sale.soldDate);
        if (!saleDate) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "sale.soldDate must be a valid date",
          });
        }

        car.markAsPaid({
          price: salePrice,
          date: saleDate,
          kiloAtSale: kiloAtSaleNum,
          buyer: sale.buyer,
          updatedBy: req.user.userId,
        });

        finalSalePrice = salePrice;

        // === Installment ===
      } else if (boughtType === "Installment") {
        const { installment } = req.body;
        if (
          !installment ||
          !installment.downPayment ||
          !installment.remainingAmount ||
          !installment.months ||
          !installment.buyer?.name ||
          !installment.buyer?.passport
        ) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message:
              "Required: installment.downPayment, installment.remainingAmount, installment.months, installment.buyer.name, installment.buyer.passport",
          });
        }

        // ✅ Validate number conversions to prevent NaN
        const downPayment = Number(installment.downPayment);
        const remainingAmount = Number(installment.remainingAmount);
        const months = Number(installment.months);

        if (isNaN(downPayment) || downPayment < 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "installment.downPayment must be a valid non-negative number",
          });
        }

        if (isNaN(remainingAmount) || remainingAmount < 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "installment.remainingAmount must be a valid non-negative number",
          });
        }

        if (isNaN(months) || months < 1 || !Number.isInteger(months)) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "installment.months must be a valid positive integer",
          });
        }

        // ✅ Validate startDate if provided
        let startDate = new Date();
        if (installment.startDate) {
          const parsedStartDate = toDate(installment.startDate);
          if (!parsedStartDate) {
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              message: "installment.startDate must be a valid date",
            });
          }
          startDate = parsedStartDate;
        }

        car.markAsInstallment({
          downPayment,
          remainingAmount,
          months,
          buyer: installment.buyer,
          startDate,
          updatedBy: req.user.userId,
        });

        // Total price = downPayment + remaining
        finalSalePrice = downPayment + remainingAmount;
      }

      // === Ensure isAvailable is set to false ===
      // Explicitly set isAvailable to false to ensure it's saved
      car.isAvailable = false;

      // Note: profit and totalRepairCost are virtual fields, they will be calculated automatically
      // No need to set them directly

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
        // .populate("updatedBy", "name email");

      if (!car) {
        return res.status(404).json({
          success: false,
          message: "Car not found",
        });
      }

      // ✅ Convert to object with virtuals and ensure images are included
      const carData = car.toObject({ virtuals: true });
      
      // Ensure images field is present (default to empty array if undefined)
      if (!carData.images) {
        carData.images = [];
      }

      return res.status(200).json({
        success: true,
        data: carData,
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
      const carId = sanitizeId(req.params.id);
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

      if (updates.licenseNo) {
        updates.licenseNo = updates.licenseNo.trim().toUpperCase();
      }
      if (updates.brand) {
        updates.brand = updates.brand.trim();
      }
      if (updates.model) {
        updates.model = updates.model.trim();
      }
      if (updates.enginePower) {
        updates.enginePower = updates.enginePower.trim();
      }
      if (updates.color) {
        updates.color = updates.color.trim();
      }

      // Handle images
      // Behavior:
      // - If new files are uploaded: By default, REPLACE all old images with new ones (delete old from Cloudinary)
      // - If replaceImages: false is set: Add new images to existing ones (append mode)
      // - If existingImages is provided (without new files): Keep only the specified existing images
      let finalImages = car.images || [];

      // Check if user wants to replace images (default: true - replace old images when uploading new ones)
      const replaceImages = updates.replaceImages !== false; // Default to true unless explicitly set to false
      
      // 1. If new files are uploaded and we're replacing, delete all old images first
      if (req.files && req.files.length > 0 && replaceImages) {
        // Delete all existing images from Cloudinary
        if (car.images && car.images.length > 0) {
          console.log(`Replacing ${car.images.length} old image(s) with ${req.files.length} new image(s)`);
          await Promise.all(
            car.images.map((img) =>
              cloudinary.uploader.destroy(img.public_id).catch((err) => {
                console.error(`Failed to delete old image ${img.public_id}:`, err);
                // Continue even if deletion fails
              })
            )
          );
        }
        // Start fresh with new images only
        finalImages = [];
      }

      // 2. Keep only images still selected on frontend (if provided and not replacing)
      if (updates.existingImages !== undefined && !(req.files && req.files.length > 0 && replaceImages)) {
        const keep = Array.isArray(updates.existingImages)
          ? updates.existingImages
          : [updates.existingImages];

        const toDelete = car.images.filter(
          (img) => !keep.includes(img.public_id)
        );

        // Delete from Cloudinary
        if (toDelete.length > 0) {
          await Promise.all(
            toDelete.map((img) =>
              cloudinary.uploader.destroy(img.public_id).catch((err) => {
                console.error(`Failed to delete image ${img.public_id}:`, err);
              })
            )
          );
        }

        finalImages = car.images.filter((img) => keep.includes(img.public_id));
      }

      // 3. Upload new files
      if (req.files && req.files.length > 0) {
        const uploaded = await Promise.all(
          req.files.map((file) =>
            streamUpload(file.buffer, `car-showroom/${car._id}`)
          )
        );

        // If replacing, set to new images only; otherwise, add to existing
        if (replaceImages) {
          finalImages = uploaded.map((img) => ({
            url: img.secure_url,
            public_id: img.public_id,
          }));
        } else {
          finalImages.push(
            ...uploaded.map((img) => ({
              url: img.secure_url,
              public_id: img.public_id,
            }))
          );
        }
        
        console.log(`Uploaded ${uploaded.length} new image(s)`);
      }

      // Save final images (only update if images were actually modified)
      if (updates.existingImages !== undefined || (req.files && req.files.length > 0)) {
        car.images = finalImages;
        car.markModified('images');
      }

      // Handle repairs array (replace entire array if provided)
      if (updates.repairs !== undefined) {
        // Parse if it's still a JSON string (fallback for edge cases)
        if (typeof updates.repairs === "string") {
          try {
            updates.repairs = JSON.parse(updates.repairs);
          } catch (e) {
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              message: "Invalid repairs JSON format",
            });
          }
        }

        // Validate that it's an array
        if (!Array.isArray(updates.repairs)) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Repairs must be an array",
          });
        }

        // Validate and transform each repair entry
        try {
          const validatedRepairs = updates.repairs.map((repair, index) => {
            // Validate required fields
            if (!repair.description || repair.cost == null) {
              throw new Error(`Repair at index ${index} is missing required fields (description, cost)`);
            }

            // Transform and validate
            return {
              description: String(repair.description).trim(),
              repairDate: toDate(repair.repairDate) || new Date(),
              cost: Number(repair.cost),
            };
          });

          // Validate cost is not NaN and is positive
          const invalidRepairs = validatedRepairs.filter(r => isNaN(r.cost) || r.cost < 0);
          if (invalidRepairs.length > 0) {
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              message: "Invalid repair cost values detected",
            });
          }

          // Replace the entire repairs array
          car.repairs = validatedRepairs;
        } catch (error) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: error.message || "Invalid repairs data",
          });
        }
      }

      // Apply other fields with proper type conversion
      if (updates.brand !== undefined) car.brand = String(updates.brand).trim();
      if (updates.model !== undefined) car.model = String(updates.model).trim();
      if (updates.year !== undefined) car.year = parseInt(updates.year);
      if (updates.enginePower !== undefined) car.enginePower = String(updates.enginePower).trim();
      if (updates.gear !== undefined) car.gear = updates.gear;
      if (updates.color !== undefined) car.color = String(updates.color).trim();
      if (updates.kilo !== undefined) car.kilo = parseFloat(updates.kilo);
      if (updates.wheelDrive !== undefined) car.wheelDrive = updates.wheelDrive;
      if (updates.purchaseDate !== undefined) car.purchaseDate = new Date(updates.purchaseDate);
      if (updates.purchasePrice !== undefined) car.purchasePrice = parseFloat(updates.purchasePrice);
      if (updates.priceToSell !== undefined) car.priceToSell = parseFloat(updates.priceToSell);
      if (updates.licenseNo !== undefined) car.licenseNo = String(updates.licenseNo).trim().toUpperCase();

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

      // ✅ Validate passport when updating buyer (passport is required in schema)
      if (buyer) {
        if (!buyer.passport) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "buyer.passport is required when updating buyer information",
          });
        }
        if (buyer.name) car.sale.buyer.name = buyer.name;
        if (buyer.phone) car.sale.buyer.phone = buyer.phone;
        if (buyer.email) car.sale.buyer.email = buyer.email;
        car.sale.buyer.passport = buyer.passport; // Always update passport if buyer is provided
      }

      // ✅ Validate number conversions
      if (kiloAtSale != null) {
        const kiloAtSaleNum = Number(kiloAtSale);
        if (isNaN(kiloAtSaleNum) || kiloAtSaleNum < 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "kiloAtSale must be a valid non-negative number",
          });
        }
        car.sale.kiloAtSale = kiloAtSaleNum;
      }

      // ✅ Validate date conversion
      if (saleDate) {
        const parsedSaleDate = toDate(saleDate);
        if (!parsedSaleDate) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "saleDate must be a valid date",
          });
        }
        car.sale.date = parsedSaleDate;
      }

      // ✅ Validate price conversion
      if (price != null) {
        const priceNum = Number(price);
        if (isNaN(priceNum) || priceNum <= 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "price must be a valid positive number",
          });
        }
        car.sale.price = priceNum;
      }

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

      // ✅ Filter by sale date or installment start date
      const cars = await Car.find({
        $or: [
          { "sale.date": { $gte: startDate, $lte: now } },
          { "installment.startDate": { $gte: startDate, $lte: now } },
        ],
        $and: [
          { isAvailable: false },
          { $or: [{ sale: { $exists: true, $ne: null } }, { installment: { $exists: true, $ne: null } }] },
        ],
      });

      const report = cars.map((car) => {
        const totalRepairs = car.repairs.reduce((sum, r) => sum + r.cost, 0);
        
        // Get sold price from sale or installment
        let soldPrice = 0;
        let soldDate = null;
        
        if (car.sale) {
          soldPrice = car.sale.price;
          soldDate = car.sale.date;
        } else if (car.installment) {
          soldPrice = car.installment.downPayment + car.installment.remainingAmount;
          soldDate = car.installment.startDate;
        } else {
          // Fallback (shouldn't happen for sold cars)
          soldPrice = car.priceToSell;
        }

        const profit = soldPrice - car.purchasePrice - totalRepairs;

        return {
          licenseNo: car.licenseNo,
          brand: car.brand,
          purchasePrice: car.purchasePrice,
          soldPrice,
          totalRepairs,
          profit,
          soldOutDate: soldDate,
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

  // ===== PUBLIC ACCESS METHODS (No Buyer/Sale Data) =====

  // Get all cars for public access (no sensitive data)
  getPublicCarList: async (req, res) => {
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

      // Select only safe fields (exclude sale, installment, repairs, purchasePrice, etc.)
      const safeFields =
        "licenseNo brand model year enginePower gear color kilo wheelDrive purchaseDate priceToSell images isAvailable createdAt updatedAt";

      const [cars, total] = await Promise.all([
        Car.find(filter)
          .select(safeFields)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
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
      console.error("Failed to fetch public cars list:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get available cars for public access (no sensitive data)
  getPublicAvailableCars: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(
        parseInt(req.query.limit) || DEFAULT_LIMIT,
        MAX_LIMIT
      );
      const skip = (page - 1) * limit;

      // Select only safe fields
      const safeFields =
        "licenseNo brand model year enginePower gear color kilo wheelDrive purchaseDate priceToSell images isAvailable createdAt updatedAt";

      const [cars, total] = await Promise.all([
        Car.find({ isAvailable: true })
          .select(safeFields)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
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
      console.error("Failed to fetch public available cars:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get single car by ID for public access (no sensitive data)
  getPublicCarById: async (req, res) => {
    try {
      const carId = sanitizeId(req.params.id);

      // Select only safe fields
      const safeFields =
        "licenseNo brand model year enginePower gear color kilo wheelDrive purchaseDate priceToSell images isAvailable createdAt updatedAt";

      const car = await Car.findById(carId).select(safeFields).lean();

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
      console.error("Error fetching public car details:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = carController;
