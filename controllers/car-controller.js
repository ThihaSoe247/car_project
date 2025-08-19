// controllers/car-controller.js
const Car = require("../model/Car");

// Safe date parser
const toDate = (v) => {
  if (!v) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const carController = {
  // Create car when it arrives to showroom (NOT sold yet)
  createCar: async (req, res) => {
    try {
      const {
        brand,
        year,
        enginePower,
        gear, // "Manual" | "Automatic"
        color,
        images,
        kilo,
        wheelDrive, // "FWD" | "RWD" | "4WD" | "AWD"
        purchaseDate,
        purchasePrice,
        priceToSell,
        licenseNo,
        repairs,
      } = req.body;

      const newCar = new Car({
        brand,
        year: Number(year),
        enginePower,
        gear,
        color,
        images,
        kilo: Number(kilo),
        wheelDrive,
        purchaseDate: toDate(purchaseDate),
        purchasePrice: Number(purchasePrice),
        priceToSell: Number(priceToSell),
        licenseNo,
        repairs: Array.isArray(repairs)
          ? repairs.map((r) => ({
              description: r.description,
              repairDate: toDate(r.repairDate),
              cost: Number(r.cost),
            }))
          : [],
        // isAvailable defaults true; sale=null
      });

      const savedCar = await newCar.save();
      return res.status(201).json({
        message: "Car added successfully",
        car: savedCar.toObject({ virtuals: true }),
      });
    } catch (error) {
      console.error("Error adding car:", error);
      return res
        .status(400)
        .json({ message: error.message || "Failed to add car" });
    }
  },

  // All cars (FE filters/sorts)
  getAllCarsList: async (_req, res) => {
    try {
      const cars = await Car.find({})
        .sort({ createdAt: -1 })
        .lean({ virtuals: true });
      return res.status(200).json(cars);
    } catch (error) {
      console.error("Failed to fetch cars list:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // Only available (unsold)
  getAvailableCars: async (_req, res) => {
    try {
      const cars = await Car.find({ isAvailable: true })
        .sort({ createdAt: -1 })
        .lean({ virtuals: true });
      return res.status(200).json(cars);
    } catch (error) {
      console.error("Failed to fetch available cars:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // Only sold (pagination + optional date range on sale.date)
  getSoldCarsList: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit) || 50, 1);
      const skip = (page - 1) * limit;

      const filter = { isAvailable: false };

      // ?from=YYYY-MM-DD&to=YYYY-MM-DD
      if (req.query.from || req.query.to) {
        filter["sale.date"] = {};
        if (req.query.from) filter["sale.date"].$gte = new Date(req.query.from);
        if (req.query.to) filter["sale.date"].$lte = new Date(req.query.to);
      }

      const [items, total] = await Promise.all([
        Car.find(filter)
          .sort({ "sale.date": -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean({ virtuals: true }),
        Car.countDocuments(filter),
      ]);

      return res.status(200).json({ page, limit, total, items });
    } catch (error) {
      console.error("Failed to fetch sold cars list:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // Mark as sold (uses sale subdoc; supports old field names too)
  markAsSold: async (req, res) => {
    try {
      const carId = req.params.id;
      const {
        price, // preferred
        soldDate, // preferred
        kiloAtSale,
        buyer, // { name, phone?, email? }
        // Back-compat aliases:
        resellPrice,
        soldOutDate,
      } = req.body;

      const finalPrice = price ?? resellPrice;
      const finalDate = soldDate ?? soldOutDate;

      if (
        finalPrice == null ||
        !finalDate ||
        kiloAtSale == null ||
        !buyer?.name
      ) {
        return res.status(400).json({
          message:
            "Required: price, soldDate, kiloAtSale, buyer.name (buyer.phone/email optional)",
        });
      }

      const car = await Car.findById(carId);
      if (!car) return res.status(404).json({ message: "Car not found" });

      if (car.isAvailable === false && car.sale) {
        // already sold
        return res.status(200).json({
          message: "Car is already marked as sold",
          car: car.toObject({ virtuals: true }),
        });
      }

      // Use schema method (keeps legacy fields in sync via pre('validate'))
      car.markAsSold({
        price: Number(finalPrice),
        date: toDate(finalDate),
        kiloAtSale: Number(kiloAtSale),
        buyer: {
          name: buyer.name,
          phone: buyer.phone,
          email: buyer.email,
        },
      });

      const updated = await car.save();
      return res.status(200).json({
        message: "Car marked as sold",
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      console.error("Error marking car as sold:", error);
      return res.status(500).json({ message: "Failed to update car" });
    }
  },

  // Single car (with virtuals)
  getCarById: async (req, res) => {
    try {
      const car = await Car.findById(req.params.id).lean({ virtuals: true });
      if (!car) return res.status(404).json({ message: "Car not found" });
      return res.status(200).json(car);
    } catch (error) {
      console.error("Error fetching car details:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // Add repair
  addRepair: async (req, res) => {
    try {
      const { carId } = req.params;
      const { description, repairDate, cost } = req.body;
      if (!description || cost == null) {
        return res
          .status(400)
          .json({ message: "description and cost are required" });
      }

      const car = await Car.findById(carId);
      if (!car) return res.status(404).json({ message: "Car not found" });

      car.repairs.push({
        description,
        repairDate: toDate(repairDate) || new Date(),
        cost: Number(cost),
      });

      const updatedCar = await car.save();
      return res.status(201).json({
        message: "Repair added",
        car: updatedCar.toObject({ virtuals: true }),
      });
    } catch (error) {
      console.error("Error adding repair:", error);
      return res.status(500).json({ message: "Failed to add repair" });
    }
  },
  // controllers/car-controller.js
  editCar: async (req, res) => {
    try {
      const carId = req.params.id;
      const updates = req.body;

      const car = await Car.findById(carId);
      if (!car) return res.status(404).json({ message: "Car not found" });

      if (car.isAvailable) {
        // Car not sold → allow full updates
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

        const updated = await car.save();
        return res.status(200).json({
          message: "Car updated successfully",
          car: updated.toObject({ virtuals: true }),
        });
      } else {
        // Car is sold → block core updates
        return res.status(400).json({
          message:
            "Cannot edit car data after it's sold. Edit sale details instead.",
        });
      }
    } catch (error) {
      console.error("Error editing car:", error);
      return res.status(500).json({ message: "Failed to edit car" });
    }
  },
  editSaleInfo: async (req, res) => {
    try {
      const car = await Car.findById(req.params.id);
      if (!car || !car.sale) {
        return res.status(400).json({ message: "Car not sold or not found." });
      }

      const { buyer, kiloAtSale, saleDate, price } = req.body;

      if (buyer?.name) car.sale.buyer.name = buyer.name;
      if (buyer?.phone) car.sale.buyer.phone = buyer.phone;
      if (buyer?.email) car.sale.buyer.email = buyer.email;
      if (kiloAtSale != null) car.sale.kiloAtSale = kiloAtSale;
      if (saleDate) car.sale.date = new Date(saleDate);
      if (price != null) car.sale.price = price;

      const updated = await car.save();
      return res.status(200).json({
        message: "Sale info updated",
        car: updated.toObject({ virtuals: true }),
      });
    } catch (error) {
      console.error("Failed to edit sale info:", error);
      return res.status(500).json({ message: "Failed to edit sale info" });
    }
  },
  // editSaleInfo: async (req, res) => {
  //   try {
  //     const car = await Car.findById(req.params.id);
  //     if (!car || !car.sale) {
  //       return res.status(400).json({ message: "Car not sold or not found." });
  //     }

  //     const { buyer, kiloAtSale, saleDate, price } = req.body;

  //     if (buyer?.name) car.sale.buyer.name = buyer.name;
  //     if (buyer?.phone) car.sale.buyer.phone = buyer.phone;
  //     if (buyer?.email) car.sale.buyer.email = buyer.email;
  //     if (kiloAtSale != null) car.sale.kiloAtSale = kiloAtSale;
  //     if (saleDate) car.sale.date = new Date(saleDate);
  //     if (price != null) car.sale.price = price;

  //     const updated = await car.save();
  //     return res.status(200).json({
  //       message: "Sale info updated",
  //       car: updated.toObject({ virtuals: true }),
  //     });
  //   } catch (error) {
  //     console.error("Failed to edit sale info:", error);
  //     return res.status(500).json({ message: "Failed to edit sale info" });
  //   }
  // },
};

module.exports = carController;
