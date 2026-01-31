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
          { boughtType: "Paid", sale: { $exists: true, $ne: null } },
          {
            boughtType: "Installment",
            "ownerBookTransfer.transferred": true,
            "installment.remainingAmount": { $lte: 0 } // Must be fully paid
          }
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
        if (!carObj.profit && car.purchasePrice) {
          const totalRepairCost = (car.repairs || []).reduce(
            (sum, r) => sum + (r.cost || 0),
            0
          );

          if (car.sale?.price) {
            // Paid sale
            carObj.profit = car.sale.price - (car.purchasePrice + totalRepairCost);
          } else if (car.installment) {
            // Installment sale - calculate total contract value
            const downPayment = car.installment.downPayment || 0;
            const paymentHistoryTotal = (car.installment.paymentHistory || [])
              .reduce((sum, p) => sum + (p.amount || 0), 0);
            const totalPaid = downPayment + paymentHistoryTotal;
            const remainingAmount = car.installment.remainingAmount || 0;
            const totalContractValue = totalPaid + remainingAmount;

            carObj.profit = totalContractValue - (car.purchasePrice + totalRepairCost);
          }
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
  // Mark car as sold via Paid payment
  markAsPaid: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
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

      // === Ensure isAvailable is set to false ===
      car.isAvailable = false;

      // Note: profit and totalRepairCost are virtual fields, they will be calculated automatically
      const updated = await car.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Car marked as sold via Paid payment",
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error marking car as paid:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update car",
      });
    } finally {
      session.endSession();
    }
  },

  // Mark car as sold via Installment payment
  markAsInstallment: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
      const { installment } = req.body;

      if (
        !installment ||
        !installment.downPayment ||
        !installment.remainingAmount ||
        !installment.months ||
        !installment.monthlyPayment ||
        !installment.buyer?.name ||
        !installment.buyer?.passport
      ) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message:
            "Required: installment.downPayment, installment.remainingAmount, installment.months, installment.monthlyPayment, installment.buyer.name, installment.buyer.passport",
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

      // ✅ Validate number conversions to prevent NaN
      const downPayment = Number(installment.downPayment);
      const remainingAmount = Number(installment.remainingAmount);
      const months = Number(installment.months);
      const monthlyPayment = Number(installment.monthlyPayment);

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

      if (isNaN(monthlyPayment) || monthlyPayment <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "installment.monthlyPayment must be a valid positive number",
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
        monthlyPayment: installment.monthlyPayment,
        updatedBy: req.user.userId,
      });

      // === Ensure isAvailable is set to false ===
      car.isAvailable = false;

      // Note: profit and totalRepairCost are virtual fields, they will be calculated automatically
      const updated = await car.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Car marked as sold via Installment payment",
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error marking car as installment:", error);
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
      // - If existingImages is provided: Keep only those images (delete others from Cloudinary)
      // - If new files are uploaded AND replaceImages is true (default): Replace all old images with new ones
      // - If new files are uploaded AND replaceImages is false: Add new images to existing ones
      let finalImages = car.images || [];

      // Debug: Log current state
      console.log(`Current car has ${car.images?.length || 0} image(s)`);
      console.log(`existingImages received:`, updates.existingImages);
      console.log(`New files to upload:`, req.files?.length || 0);

      // Check if user wants to replace images (default: true - replace old images when uploading new ones)
      const replaceImages = updates.replaceImages !== false; // Default to true unless explicitly set to false

      // Step 1: Handle existingImages - determine which images to keep
      // This handles the case where user removes some images from frontend
      // existingImages can be: array of public_ids, JSON string, empty array (remove all), or undefined (keep all)
      const hasExistingImagesParam = updates.existingImages !== undefined;

      if (hasExistingImagesParam) {
        let keep = [];

        // Handle empty array case (remove all images)
        if (Array.isArray(updates.existingImages) && updates.existingImages.length === 0) {
          keep = [];
        }
        // Parse existingImages - handle both array and JSON string formats
        else if (typeof updates.existingImages === 'string') {
          // Handle empty string
          if (updates.existingImages.trim() === '' || updates.existingImages === '[]') {
            keep = [];
          } else {
            try {
              const parsed = JSON.parse(updates.existingImages);
              keep = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
              // If parsing fails, treat as single value
              keep = [updates.existingImages];
            }
          }
        } else if (Array.isArray(updates.existingImages)) {
          keep = updates.existingImages;
        } else if (updates.existingImages !== null && updates.existingImages !== '') {
          keep = [updates.existingImages];
        }

        console.log(`existingImages parameter received:`, updates.existingImages);
        console.log(`Parsed images to keep (public_ids):`, keep);
        console.log(`Current car images (public_ids):`, car.images.map(img => img.public_id));

        // Normalize keep list - extract public_id if objects are sent instead of just IDs
        const keepPublicIds = keep.map(item => {
          if (typeof item === 'object' && item !== null && item.public_id) {
            return String(item.public_id);
          }
          return String(item); // Ensure it's a string for comparison
        }).filter(id => id && id !== 'null' && id !== 'undefined'); // Remove invalid values

        console.log(`Normalized keepPublicIds:`, keepPublicIds);

        // Find images to delete (images not in the keep list)
        const toDelete = car.images.filter(
          (img) => !keepPublicIds.includes(String(img.public_id))
        );

        console.log(`Images to delete: ${toDelete.length}`, toDelete.map(img => ({ public_id: img.public_id, url: img.url })));

        // Delete removed images from Cloudinary
        if (toDelete.length > 0) {
          console.log(`Removing ${toDelete.length} image(s) from Cloudinary...`);
          const deleteResults = await Promise.allSettled(
            toDelete.map((img) => cloudinary.uploader.destroy(img.public_id))
          );

          const successful = deleteResults.filter(r => r.status === 'fulfilled').length;
          const failed = deleteResults.filter(r => r.status === 'rejected').length;

          deleteResults.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.error(`Failed to delete image ${toDelete[index].public_id}:`, result.reason);
            }
          });

          console.log(`Cloudinary deletion: ${successful} successful, ${failed} failed`);
        } else if (keepPublicIds.length === 0 && car.images.length > 0) {
          // All images should be removed
          console.log(`Removing ALL ${car.images.length} image(s) from Cloudinary (empty keep list)`);
          await Promise.allSettled(
            car.images.map((img) => cloudinary.uploader.destroy(img.public_id))
          );
        }

        // Start with only the images that should be kept
        // If keep is empty array, all images were removed
        finalImages = car.images.filter((img) => keepPublicIds.includes(String(img.public_id)));
        console.log(`Final images after removal: ${finalImages.length} (kept ${finalImages.length} out of ${car.images.length} original)`);
      }

      // Step 2: Handle new file uploads
      if (req.files && req.files.length > 0) {
        // If replacing (default behavior), delete all remaining old images before uploading new ones
        if (replaceImages && finalImages.length > 0) {
          console.log(`Replacing ${finalImages.length} old image(s) with ${req.files.length} new image(s)`);
          await Promise.all(
            finalImages.map((img) =>
              cloudinary.uploader.destroy(img.public_id).catch((err) => {
                console.error(`Failed to delete old image ${img.public_id}:`, err);
                // Continue even if deletion fails
              })
            )
          );
          // Clear old images since we're replacing
          finalImages = [];
        }

        // Upload new files
        const uploaded = await Promise.all(
          req.files.map((file) =>
            streamUpload(file.buffer, `car-showroom/${car._id}`)
          )
        );

        // Add new images to finalImages
        const newImageObjs = uploaded.map((img) => ({
          url: img.secure_url,
          public_id: img.public_id,
        }));

        if (replaceImages) {
          // Replace mode: only new images
          finalImages = newImageObjs;
        } else {
          // Append mode: add to existing
          finalImages.push(...newImageObjs);
        }

        console.log(`Uploaded ${uploaded.length} new image(s)`);
      }

      // Step 3: Save final images (update if images were modified)
      // Always update if existingImages was provided (even if empty) or if new files were uploaded
      const imagesModified = hasExistingImagesParam || (req.files && req.files.length > 0);
      if (imagesModified) {
        car.images = finalImages;
        car.markModified('images');
        console.log(`Saving car with ${finalImages.length} image(s) in database`);
        console.log(`Image URLs in database:`, finalImages.map(img => img.url));
      } else {
        console.log(`No image modifications detected - keeping existing ${car.images?.length || 0} image(s)`);
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

      // Verify images before save
      console.log(`About to save car with ${car.images?.length || 0} image(s)`);
      if (car.images && car.images.length > 0) {
        console.log(`Images to be saved:`, car.images.map(img => ({ public_id: img.public_id, url: img.url })));
      }

      const updated = await car.save({ session });
      await session.commitTransaction();

      // Reload from database to ensure we have the latest data
      const savedCar = await Car.findById(car._id);
      const carData = savedCar.toObject({ virtuals: true });

      console.log(`Car saved successfully with ${carData.images?.length || 0} image(s) in database`);
      if (carData.images && carData.images.length > 0) {
        console.log(`Final image URLs in response:`, carData.images.map(img => img.url));
      }

      res.status(200).json({
        success: true,
        message: "Car updated successfully",
        car: carData,
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
        $or: [
          { ownerBookTransfer: { $exists: false } },
          { "ownerBookTransfer.transferred": false }
        ]
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

  // Edit installment information
  editInstallmentInfo: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
      const car = await Car.findById(carId).session(session);

      if (!car || !car.installment) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Car not sold on installment or not found",
        });
      }

      const {
        buyer,
        downPayment,
        remainingAmount,
        months,
        startDate,
        monthlyPayment,
      } = req.body;

      // ✅ Validate and update buyer information
      if (buyer) {
        if (!buyer.passport) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "buyer.passport is required when updating buyer information",
          });
        }
        if (buyer.name) car.installment.buyer.name = buyer.name;
        if (buyer.phone) car.installment.buyer.phone = buyer.phone;
        if (buyer.email) car.installment.buyer.email = buyer.email;
        car.installment.buyer.passport = buyer.passport;
      }

      // ✅ Validate and update downPayment
      if (downPayment != null) {
        const downPaymentNum = Number(downPayment);
        if (isNaN(downPaymentNum) || downPaymentNum < 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "downPayment must be a valid non-negative number",
          });
        }
        car.installment.downPayment = downPaymentNum;
      }

      // ✅ Validate and update remainingAmount
      if (remainingAmount != null) {
        const remainingAmountNum = Number(remainingAmount);
        if (isNaN(remainingAmountNum) || remainingAmountNum < 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "remainingAmount must be a valid non-negative number",
          });
        }
        car.installment.remainingAmount = remainingAmountNum;
      }

      // ✅ Validate and update months
      if (months != null) {
        const monthsNum = Number(months);
        if (
          isNaN(monthsNum) ||
          monthsNum < 1 ||
          !Number.isInteger(monthsNum)
        ) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "months must be a valid positive integer",
          });
        }
        car.installment.months = monthsNum;
      }

      // ✅ Validate and update startDate
      if (startDate) {
        const parsedStartDate = toDate(startDate);
        if (!parsedStartDate) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "startDate must be a valid date",
          });
        }
        car.installment.startDate = parsedStartDate;
      }

      // Mark installment as modified
      car.markModified("installment");

      const updated = await car.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Installment info updated successfully",
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Failed to edit installment info:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to edit installment info",
      });
    } finally {
      session.endSession();
    }
  },

  // Add payment to installment
  addInstallmentPayment: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
      const { amount, paymentDate, notes } = req.body;

      if (!amount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Payment amount is required",
        });
      }

      const car = await Car.findById(carId).session(session);
      if (!car || !car.installment) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Car not sold on installment or not found",
        });
      }

      // Validate payment amount
      const paymentAmount = Number(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Payment amount must be a valid positive number",
        });
      }

      if (paymentAmount > car.installment.remainingAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Payment amount (${paymentAmount}) exceeds remaining amount (${car.installment.remainingAmount})`,
        });
      }

      // Validate payment date if provided
      let parsedPaymentDate = new Date();
      if (paymentDate) {
        parsedPaymentDate = toDate(paymentDate);
        if (!parsedPaymentDate) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "paymentDate must be a valid date",
          });
        }
      }

      // Add payment using instance method
      try {
        car.addInstallmentPayment(
          paymentAmount,
          parsedPaymentDate,
          notes || ""
        );
      } catch (error) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      // Mark installment as modified
      car.markModified("installment");
      car.markModified("installment.paymentHistory");

      const updated = await car.save({ session });
      await session.commitTransaction();

      // Calculate payment summary
      const paymentHistoryTotal = (
        updated.installment.paymentHistory || []
      ).reduce((sum, p) => sum + (p.amount || 0), 0);
      const paidAmount =
        (updated.installment.downPayment || 0) + paymentHistoryTotal;
      const totalAmount =
        (updated.installment.downPayment || 0) +
        (updated.installment.remainingAmount || 0) +
        paymentHistoryTotal;
      const paymentProgress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

      return res.status(200).json({
        success: true,
        message: "Payment recorded successfully",
        car: updated.toObject({ virtuals: true }),
        paymentSummary: {
          paymentAmount,
          remainingAmount: updated.installment.remainingAmount,
          paidAmount,
          totalAmount,
          paymentProgress: Math.min(paymentProgress, 100),
          isFullyPaid: updated.installment.remainingAmount <= 0,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Failed to add installment payment:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to add payment",
      });
    } finally {
      session.endSession();
    }
  },

  // Upsert installment payment by month (includes penalty tracking)
  upsertInstallmentPaymentByMonth: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
      const { monthNumber, paid, penaltyFee = 0, paymentDate, notes, amount } =
        req.body;

      const month = Number(monthNumber);
      if (!Number.isInteger(month) || month < 1) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "monthNumber must be a positive integer",
        });
      }

      if (paid === undefined) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "paid flag is required",
        });
      }

      const penalty = Number(penaltyFee || 0);
      if (Number.isNaN(penalty) || penalty < 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "penaltyFee must be zero or a positive number",
        });
      }

      const car = await Car.findById(carId).session(session);
      if (!car || !car.installment) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Car not found or not sold on installment",
        });
      }

      const monthlyPayment =
        amount !== undefined && amount !== null
          ? Number(amount)
          : Number(car.installment.monthlyPayment || 0);

      if (Number.isNaN(monthlyPayment) || monthlyPayment < 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Payment amount must be zero or a positive number",
        });
      }

      // Calculate the original total before changes
      const currentHistory = [...(car.installment.paymentHistory || [])];
      const historyPaidTotal = currentHistory.reduce(
        (sum, p) => sum + (p.amount || 0),
        0
      );
      const originalTotal =
        (car.installment.downPayment || 0) +
        (car.installment.remainingAmount || 0) +
        historyPaidTotal;

      let updatedHistory = currentHistory;

      if (paid) {
        let parsedPaymentDate = paymentDate ? toDate(paymentDate) : new Date();
        if (paymentDate && !parsedPaymentDate) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "paymentDate must be a valid date",
          });
        }

        const existingIndex = updatedHistory.findIndex(
          (p) => p.monthNumber === month
        );

        if (existingIndex >= 0) {
          updatedHistory[existingIndex] = {
            ...updatedHistory[existingIndex],
            monthNumber: month,
            amount: monthlyPayment,
            penaltyFee: penalty,
            paymentDate: parsedPaymentDate || new Date(),
            notes:
              notes !== undefined
                ? notes
                : updatedHistory[existingIndex].notes || "",
          };
        } else {
          updatedHistory.push({
            monthNumber: month,
            amount: monthlyPayment,
            penaltyFee: penalty,
            paymentDate: parsedPaymentDate || new Date(),
            notes: notes || "",
          });
        }
      } else {
        updatedHistory = updatedHistory.filter(
          (p) => p.monthNumber !== month
        );
      }

      // Recalculate remaining amount based on the original total
      const newHistoryPaidTotal = updatedHistory.reduce(
        (sum, p) => sum + (p.amount || 0),
        0
      );
      const newRemainingAmount = Math.max(
        0,
        originalTotal - (car.installment.downPayment || 0) - newHistoryPaidTotal
      );

      car.installment.paymentHistory = updatedHistory;
      car.installment.remainingAmount = newRemainingAmount;
      car.markModified("installment");
      car.markModified("installment.paymentHistory");

      const updatedCar = await car.save({ session });
      await session.commitTransaction();

      const paidMonths = Array.from(
        new Set(
          (updatedCar.installment.paymentHistory || [])
            .map((p) => p.monthNumber)
            .filter((m) => m != null)
        )
      ).sort((a, b) => a - b);

      const penaltyMap = (updatedCar.installment.paymentHistory || []).reduce(
        (acc, p) => {
          if (p.monthNumber != null) {
            acc[p.monthNumber] = p.penaltyFee || 0;
          }
          return acc;
        },
        {}
      );

      const totalPenalty = (updatedCar.installment.paymentHistory || []).reduce(
        (sum, p) => sum + (p.penaltyFee || 0),
        0
      );

      const totalPaid = (updatedCar.installment.paymentHistory || []).reduce(
        (sum, p) => sum + (p.amount || 0),
        0
      );

      return res.status(200).json({
        success: true,
        message: paid ? "Payment recorded" : "Payment removed",
        data: {
          carId: updatedCar._id,
          remainingAmount: newRemainingAmount,
          paidMonths,
          penaltyFees: penaltyMap,
          totalPenalty,
          totalPaid,
          monthlyPayment: updatedCar.installment.monthlyPayment,
          installmentPeriod: updatedCar.installment.months,
          paymentHistory: updatedCar.installment.paymentHistory,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Failed to upsert installment payment:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update installment payment",
      });
    } finally {
      session.endSession();
    }
  },

  // Get installment details for a specific car
  getCarInstallmentDetails: async (req, res) => {
    try {
      const carId = sanitizeId(req.params.id);

      const car = await Car.findById(carId);

      if (!car) {
        return res.status(404).json({
          success: false,
          message: "Car not found",
        });
      }

      if (!car.installment) {
        return res.status(404).json({
          success: false,
          message: "Car is not sold on installment",
        });
      }

      // Convert to object with virtuals to include installment calculations
      const carData = car.toObject({ virtuals: true });

      // Calculate payment summary
      const paymentHistoryTotal = (
        carData.installment.paymentHistory || []
      ).reduce((sum, p) => sum + (p.amount || 0), 0);
      const paidAmount =
        (carData.installment.downPayment || 0) + paymentHistoryTotal;
      const totalAmount =
        (carData.installment.downPayment || 0) +
        (carData.installment.remainingAmount || 0) +
        paymentHistoryTotal;
      const paymentProgress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

      return res.status(200).json({
        success: true,
        data: {
          car: {
            _id: carData._id,
            licenseNo: carData.licenseNo,
            brand: carData.brand,
            model: carData.model,
            year: carData.year,
            color: carData.color,
            priceToSell: carData.priceToSell,
            purchasePrice: carData.purchasePrice,
          },
          installment: carData.installment,
          paymentSummary: {
            paidAmount,
            totalAmount,
            remainingAmount: carData.installment.remainingAmount,
            paymentProgress: Math.min(paymentProgress, 100),
            isFullyPaid: carData.installment.remainingAmount <= 0,
            monthlyPayment: carData.installment.monthlyPayment,
            downPayment: carData.installment.downPayment,
            paymentsMade: carData.installment.paymentHistory?.length || 0,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching car installment details:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

// Helper function to get date range based on period
const getDateRange = (period) => {
  const now = new Date();
  let startDate;

  if (period === "monthly") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === "6months") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  } else if (period === "yearly") {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    throw new Error("Invalid period");
  }

  return { startDate, now };
};

// Helper function to calculate profit for a car (General Profit)
const calculateCarProfit = (car) => {
  const totalRepairs = car.repairs.reduce((sum, r) => sum + r.cost, 0);
  let soldPrice = 0;
  let soldDate = null;

  if (car.sale) {
    // Paid sale - soldPrice is actual sale price
    soldPrice = car.sale.price;
    soldDate = car.sale.date;
  } else if (car.installment) {
    // Installment sale - soldPrice = priceToSell (base car price, no negotiation)
    // For general profit, we use the base car price, NOT the contract value
    soldPrice = car.priceToSell;
    soldDate = car.installment.startDate;
  } else {
    // Fallback (shouldn't happen for sold cars)
    soldPrice = car.priceToSell;
  }

  // General Profit = soldPrice - (purchasePrice + repairs)
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
};

// Helper function to calculate detailed profit for a car
const calculateCarProfitDetails = (car) => {
  const totalRepairs = car.repairs.reduce((sum, r) => sum + r.cost, 0);
  let soldPrice = 0;
  let soldDate = null;
  let sellingPrice = 0;
  let paymentBreakdown = {};
  let generalProfit = 0;
  let detailedProfit = 0;
  let contractValue = 0;

  if (car.sale) {
    // Paid sale - sellingPrice is original asking price, soldPrice is actual sale price
    sellingPrice = car.priceToSell; // Original asking price
    soldPrice = car.sale.price; // Actual sale price
    soldDate = car.sale.date;
    generalProfit = soldPrice - car.purchasePrice - totalRepairs;
    detailedProfit = generalProfit; // Same for paid sales
    contractValue = soldPrice;
    paymentBreakdown = {
      downPayment: 0,
      monthlyPayments: [],
      totalPaid: car.sale.price,
      penaltyFeesTotal: 0,
      remainingAmount: 0,
      monthlyPayment: 0
    };
  } else if (car.installment) {
    // Installment sale - sellingPrice = soldPrice = priceToSell (fixed price, no negotiation)
    sellingPrice = car.priceToSell; // Base car price
    soldPrice = car.priceToSell; // Same as sellingPrice
    soldDate = car.installment.startDate;

    const downPayment = car.installment.downPayment || 0;
    const paymentHistoryTotal = (car.installment.paymentHistory || [])
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const penaltyFeesTotal = (car.installment.paymentHistory || [])
      .reduce((sum, p) => sum + (p.penaltyFee || 0), 0);
    const totalPaid = downPayment + paymentHistoryTotal;
    const remainingAmount = car.installment.remainingAmount || 0;

    // Contract value includes all payments + penalties (financing charges, taxes, etc.)
    contractValue = totalPaid + remainingAmount;

    // Total Sales = (Down + Monthly + Penalties) - Repairs
    // Represents net revenue collected from customer
    const totalSales = (downPayment + paymentHistoryTotal) - totalRepairs;

    // General profit = base car price - costs (profit on the car itself)
    generalProfit = car.priceToSell - car.purchasePrice - totalRepairs;

    // Detailed profit = contract value - costs (includes financing income + penalties)
    detailedProfit = contractValue - car.purchasePrice - totalRepairs;

    paymentBreakdown = {
      downPayment,
      //monthlyPayments: car.installment.paymentHistory || [],
      totalPaid,
      penaltyFeesTotal,
      remainingAmount,
      monthlyPayment: car.installment.monthlyPayment || 0,
      totalSales // Add to payment breakdown
    };
  } else {
    // Fallback
    sellingPrice = car.priceToSell;
    soldPrice = car.priceToSell;
    generalProfit = car.priceToSell - car.purchasePrice - totalRepairs;
    detailedProfit = generalProfit;
    contractValue = car.priceToSell;
    paymentBreakdown = {
      downPayment: 0,
      monthlyPayments: [],
      totalPaid: car.priceToSell,
      penaltyFeesTotal: 0,
      remainingAmount: 0,
      monthlyPayment: 0
    };
  }

  // Determine the report date with fallback logic
  // Prefer installment.startDate, but include fallback fields
  const reportDate = soldDate ||
    car.soldOutDate ||
    car.soldDate ||
    car.saleDate ||
    car.startDate ||
    car.date ||
    car.createdAt;

  return {
    id: car._id?.toString() || car.id?.toString(),  // Include both _id and id for compatibility
    //_id: car._id,  // Include MongoDB _id
    licenseNo: car.licenseNo,
    brand: car.brand,
    purchasePrice: car.purchasePrice,
    //sellingPrice, // Original asking price
    soldPrice, // Actual sale price (for paid) or priceToSell (for installment)
    contractValue, // Total revenue including penalties (for installment)
    totalRepairs,
    //profit: detailedProfit, // Numeric profit value (use detailedProfit for total profit)
    reportDate,  // The chosen report date with fallbacks
    generalProfit, // Profit on car itself
    detailedProfit, // Total income including financing (for installment)
    paymentBreakdown
  };
};

// Add the new controller methods to the exports
module.exports = {
  ...carController,
  // Original combined route (kept for backward compatibility)
  getProfitAnalysis: async (req, res) => {
    try {
      const { period } = req.query;
      const { startDate, now } = getDateRange(period);

      // ✅ Filter by appropriate completion date for each type
      // Paid: sale.date (profit realized immediately)
      // Installment: transferDate (profit realized when deal completes)
      const cars = await Car.find({
        $or: [
          {
            "sale.date": { $gte: startDate, $lte: now },
            boughtType: "Paid",
            sale: { $exists: true, $ne: null }
          },
          {
            "ownerBookTransfer.transferDate": { $gte: startDate, $lte: now },
            boughtType: "Installment",
            installment: { $exists: true, $ne: null },
            "installment.remainingAmount": { $lte: 0 }, // Fully paid
            "ownerBookTransfer.transferred": true // Owner book transferred
          }
        ],
        isAvailable: false
      });

      const report = cars.map(calculateCarProfit);
      const totalProfit = report.reduce((sum, r) => sum + r.profit, 0);

      res.json({ success: true, totalProfit, cars: report });
    } catch (err) {
      console.error("Error generating profit analysis:", err);
      if (err.message === "Invalid period") {
        return res.status(400).json({ success: false, message: "Invalid period" });
      }
      res.status(500).json({ success: false, message: "Failed to generate report" });
    }
  },

  // New: Paid sales profit analysis only
  getPaidProfitAnalysis: async (req, res) => {
    try {
      const { period } = req.query;
      const { startDate, now } = getDateRange(period);

      // Filter only paid sales
      const cars = await Car.find({
        "sale.date": { $gte: startDate, $lte: now },
        isAvailable: false,
        boughtType: "Paid",
        sale: { $exists: true, $ne: null }
      });

      const report = cars.map(calculateCarProfit);
      const totalProfit = report.reduce((sum, r) => sum + r.profit, 0);

      res.json({
        success: true,
        totalProfit,
        cars: report,
        reportType: "paid",
        count: report.length
      });
    } catch (err) {
      console.error("Error generating paid profit analysis:", err);
      if (err.message === "Invalid period") {
        return res.status(400).json({ success: false, message: "Invalid period" });
      }
      res.status(500).json({ success: false, message: "Failed to generate paid profit report" });
    }
  },

  // New: Installment sales profit analysis only (with both general and detailed profit)
  getInstallmentProfitAnalysis: async (req, res) => {
    try {
      const { period } = req.query;

      // Validate period parameter (required)
      if (!period) {
        return res.status(400).json({
          success: false,
          message: "Period query parameter is required (monthly | 6months | yearly)"
        });
      }

      // Validate period has correct value
      const validPeriods = ["monthly", "6months", "yearly"];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          success: false,
          message: "Invalid period. Must be one of: monthly, 6months, yearly"
        });
      }

      // Get date range for the period
      const { startDate, now } = getDateRange(period);

      // Filter only COMPLETED installment sales (fully paid + owner book transferred)
      // ✅ Use transferDate to recognize profit in correct period (when deal completes)
      const cars = await Car.find({
        "ownerBookTransfer.transferDate": { $gte: startDate, $lte: now },
        isAvailable: false,
        boughtType: "Installment",
        installment: { $exists: true, $ne: null },
        "installment.remainingAmount": { $lte: 0 }, // ✅ Must be fully paid
        "ownerBookTransfer.transferred": true // ✅ Must have owner book transferred
      });

      // Use calculateCarProfitDetails for comprehensive profit breakdown
      const report = cars.map(calculateCarProfitDetails);

      // Calculate total general profit (profit on car itself)
      const totalGeneralProfit = report.reduce((sum, r) => sum + r.generalProfit, 0);

      // Calculate total detailed profit (includes financing income, taxes, penalties)
      const totalDetailedProfit = report.reduce((sum, r) => sum + r.detailedProfit, 0);

      // Calculate total penalty fees collected
      const totalPenaltyFees = report.reduce((sum, r) => sum + (r.paymentBreakdown?.penaltyFeesTotal || 0), 0);

      // Calculate total sales (net revenue after repairs)
      const totalSales = report.reduce((sum, r) => sum + (r.paymentBreakdown?.totalSales || 0), 0);

      // Calculate total repair costs
      const totalRepairCosts = report.reduce((sum, r) => sum + (r.totalRepairs || 0), 0);

      // Calculate financing income (difference between detailed and general profit)
      const financingIncome = totalDetailedProfit - totalGeneralProfit;

      // Return response with proper structure
      return res.status(200).json({
        success: true,
        reportType: "installment",
        count: report.length,
        summary: {
          totalGeneralProfit,    // Profit on the car itself (priceToSell - purchasePrice - repairs)
          totalDetailedProfit,   // Total income including financing (contractValue - purchasePrice - repairs)
          totalSales,            // Net revenue collected from customers (Down + Monthly + Penalties - Repairs)
          totalRepairCosts,      // Total spent on repairs
          totalPenaltyFees,      // Total penalty fees collected
          financingIncome        // Extra income from financing (taxes, fees, penalties)
        },
        cars: report  // Always return array even if empty
      });
    } catch (err) {
      console.error("Error generating installment profit analysis:", err);

      // Return 500 with clear error message
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to generate installment profit report"
      });
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

      res.status(200).json({
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
      console.error("Error fetching public car list:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get available cars for public access
  getPublicAvailableCars: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(
        parseInt(req.query.limit) || DEFAULT_LIMIT,
        MAX_LIMIT
      );
      const skip = (page - 1) * limit;

      // Build filter based on query parameters
      const filter = { isAvailable: true };

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

      res.status(200).json({
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
      console.error("Error fetching public available cars:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get single car details for public access
  getPublicCarById: async (req, res) => {
    try {
      const carId = sanitizeId(req.params.id);
      const car = await Car.findById(carId).select(
        "licenseNo brand model year enginePower gear color kilo wheelDrive purchaseDate priceToSell images isAvailable createdAt updatedAt"
      );

      if (!car) {
        return res.status(404).json({
          success: false,
          message: "Car not found",
        });
      }

      res.status(200).json({
        success: true,
        data: car,
      });
    } catch (error) {
      console.error("Error fetching public car details:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  ownerBookTransfer: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
      const { notes } = req.body;

      const car = await Car.findById(carId).session(session);
      if (!car) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Car not found",
        });
      }

      // Check if car is sold (either paid or installment)
      if ((!car.sale && !car.installment) || car.isAvailable) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Car is not sold or is still available",
        });
      }

      // Check if already transferred
      if (car.ownerBookTransfer?.transferred) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Owner book already transferred",
        });
      }

      // For installment cars, check if all payments are completed
      if (car.boughtType === "Installment" && car.installment?.remainingAmount > 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "All installment payments must be completed before transfer",
        });
      }

      // Mark owner book transfer (works for both paid and installment)
      car.ownerBookTransfer = {
        transferred: true,
        transferDate: new Date(),
        notes: notes || "",
      };

      // Keep boughtType unchanged for analysis purposes
      car.isAvailable = false;

      const updated = await car.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: `Owner book transferred successfully for ${car.boughtType.toLowerCase()} sale.`,
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error transferring owner book:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to transfer owner book",
      });
    } finally {
      session.endSession();
    }
  },
};
