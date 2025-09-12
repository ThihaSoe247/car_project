// controllers/car-controller.js
const Car = require("../model/Car");
const mongoose = require("mongoose");

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
  // Create car when it arrives to showroom
  createCar: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        brand,
        year,
        enginePower,
        gear,
        color,
        images,
        kilo,
        wheelDrive,
        purchaseDate,
        purchasePrice,
        priceToSell,
        licenseNo,
        repairs,
      } = req.body;

      // Check if license number already exists
      if (licenseNo) {
        const existingCar = await Car.findOne({ licenseNo }).session(session);
        if (existingCar) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Car with this license number already exists",
          });
        }
      }

      // Determine user ID - use authenticated user or default Staff user
      const userId = req.user ? req.user.userId : STAFF_USER_ID;

      const newCar = new Car({
        brand,
        year: Number(year),
        enginePower,
        gear,
        color,
        images: Array.isArray(images) ? images : [],
        kilo: Number(kilo),
        wheelDrive,
        purchaseDate: toDate(purchaseDate),
        purchasePrice: Number(purchasePrice),
        priceToSell: Number(priceToSell),
        licenseNo,
        repairs: Array.isArray(repairs)
          ? repairs.map((r) => ({
              description: r.description,
              repairDate: toDate(r.repairDate) || new Date(),
              cost: Number(r.cost),
            }))
          : [],
        // createdBy: userId,
        // updatedBy: userId,
      });

      const savedCar = await newCar.save({ session });
      await session.commitTransaction();

      return res.status(201).json({
        success: true,
        message: "Car added successfully",
        car: savedCar.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error adding car:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to add car",
      });
    } finally {
      session.endSession();
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

  // Get sold cars with pagination and date filtering
  // getSoldCarsList: async (req, res) => {
  //   try {
  //     const page = Math.max(parseInt(req.query.page) || 1, 1);
  //     const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  //     const skip = (page - 1) * limit;

  //     const filter = { isAvailable: false };

  //     // Date range filtering
  //     if (req.query.from || req.query.to) {
  //       filter["sale.date"] = {};
  //       if (req.query.from) {
  //         const fromDate = toDate(req.query.from);
  //         if (fromDate) filter["sale.date"].$gte = fromDate;
  //       }
  //       if (req.query.to) {
  //         const toDate = toDate(req.query.to);
  //         if (toDate) filter["sale.date"].$lte = toDate;
  //       }
  //     }

  //     const [cars, total] = await Promise.all([
  //       Car.find(filter)
  //         .sort({ "sale.date": -1, createdAt: -1 })
  //         .skip(skip)
  //         .limit(limit)
  //         .populate('createdBy', 'name email')
  //         .populate('updatedBy', 'name email')
  //         .lean({ virtuals: true }),
  //       Car.countDocuments(filter),
  //     ]);

  //     return res.status(200).json({
  //       success: true,
  //       data: cars,
  //       pagination: {
  //         page,
  //         limit,
  //         total,
  //         pages: Math.ceil(total / limit)
  //       }
  //     });
  //   } catch (error) {
  //     console.error("Failed to fetch sold cars list:", error);
  //     return res.status(500).json({
  //       success: false,
  //       message: "Internal server error"
  //     });
  //   }
  // },
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

  // Mark car as sold with transaction
  // markAsSold: async (req, res) => {
  //   const session = await mongoose.startSession();
  //   session.startTransaction();

  //   try {
  //     const carId = sanitizeId(req.params.id);
  //     const { price, soldDate, kiloAtSale, buyer } = req.body;

  //     if (!price || !soldDate || kiloAtSale == null || !buyer?.name) {
  //       await session.abortTransaction();
  //       return res.status(400).json({
  //         success: false,
  //         message: "Required: price, soldDate, kiloAtSale, buyer.name",
  //       });
  //     }

  //     const car = await Car.findById(carId).session(session);
  //     if (!car) {
  //       await session.abortTransaction();
  //       return res.status(404).json({
  //         success: false,
  //         message: "Car not found",
  //       });
  //     }

  //     if (!car.isAvailable) {
  //       await session.abortTransaction();
  //       return res.status(400).json({
  //         success: false,
  //         message: "Car is already marked as sold",
  //       });
  //     }

  //     car.markAsSold({
  //       price: Number(price),
  //       date: toDate(soldDate),
  //       kiloAtSale: Number(kiloAtSale),
  //       buyer: {
  //         name: buyer.name,
  //         phone: buyer.phone,
  //         email: buyer.email,
  //       },
  //       updatedBy: req.user.userId,
  //     });

  //     const updated = await car.save({ session });
  //     await session.commitTransaction();

  //     return res.status(200).json({
  //       success: true,
  //       message: "Car marked as sold",
  //       car: updated.toObject({ virtuals: true }),
  //     });
  //   } catch (error) {
  //     await session.abortTransaction();
  //     console.error("Error marking car as sold:", error);
  //     return res.status(500).json({
  //       success: false,
  //       message: error.message || "Failed to update car",
  //     });
  //   } finally {
  //     session.endSession();
  //   }
  // },
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

      // Branch by boughtType
      if (boughtType === "Paid") {
        const { sale } = req.body; // <-- destructure sale
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
      }

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

  // Edit car details
  editCar: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const carId = sanitizeId(req.params.id);
      const updates = req.body;

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
          message:
            "Cannot edit car data after it's sold. Edit sale details instead.",
        });
      }

      // Check license number uniqueness if being updated
      if (updates.licenseNo && updates.licenseNo !== car.licenseNo) {
        const existingCar = await Car.findOne({
          licenseNo: updates.licenseNo,
          _id: { $ne: carId },
        }).session(session);

        if (existingCar) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Car with this license number already exists",
          });
        }
      }

      const allowedFields = [
        "brand",
        "year",
        "enginePower",
        "gear",
        "color",
        "images",
        "kilo",
        "wheelDrive",
        "purchaseDate",
        "purchasePrice",
        "priceToSell",
        "licenseNo",
      ];

      allowedFields.forEach((field) => {
        if (field in updates) {
          car[field] = updates[field];
        }
      });

      car.updatedBy = req.user.userId;

      const updated = await car.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Car updated successfully",
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Error editing car:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to edit car",
      });
    } finally {
      session.endSession();
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
};

module.exports = carController;
