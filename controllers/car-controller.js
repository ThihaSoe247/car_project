const Car = require("../model/Car");

const carController = {
  createCar: async (req, res) => {
    try {
      const {
        brand,
        model,
        year,
        fuelType,
        transmission,
        color,
        mileage,
        images,
        licenseNo,
        enginePower,
        wheelDrive,
        priceToSell,
        boughtPrice,
        showroomBoughtDate,
        repairs,
      } = req.body;

      const newCar = new Car({
        brand,
        model,
        year,
        fuelType,
        transmission,
        color,
        mileage,
        images,
        licenseNo,
        enginePower,
        wheelDrive,
        priceToSell,
        boughtPrice,
        showroomBoughtDate,
        repairs: repairs || [],
      });

      const savedCar = await newCar.save();
      res
        .status(201)
        .json({ message: "Car added successfully", car: savedCar });
    } catch (error) {
      console.error("Error adding car:", error);
      res.status(500).json({ message: "Failed to add car" });
    }
  },
  getAllCarsList: async (req, res) => {
    try {
      const cars = await Car.find(
        {},
        {
          licenseNo: 1,
          year: 1,
          enginePower: 1,
          wheelDrive: 1,
          transmission: 1,
          priceToSell: 1,
          brand: 1,
          model: 1,
        }
      ).lean();
      const carList = cars.map((car) => ({
        id: car._id,
        brand: car.brand || "-",
        model: car.model || "-",
        licenseNo: car.licenseNo || "-",
        year: car.year,
        enginePower: car.enginePower || "-",
        wheelDrive: car.wheelDrive || "-",
        gear: car.transmission,
        priceToShow: car.priceToSell
          ? `฿${car.priceToSell.toLocaleString("en-TH")}`
          : "-",
      }));

      res.status(200).json(carList);
    } catch (error) {
      console.error("Failed to fetch cars list:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
  markAsSold: async (req, res) => {
    try {
      const carId = req.params.id;
      const { resellPrice, soldOutDate } = req.body;

      if (!resellPrice || !soldOutDate) {
        return res.status(400).json({
          message: "resellPrice and soldOutDate are required to mark as sold",
        });
      }

      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({ message: "Car not found" });
      }

      car.resellPrice = resellPrice;
      car.soldOutDate = soldOutDate;
      car.isAvailable = false;

      const updatedCar = await car.save();

      res.status(200).json({
        message: "Car marked as sold",
        car: updatedCar.toObject({ virtuals: true }),
      });
    } catch (error) {
      console.error("Error marking car as sold:", error);
      res.status(500).json({ message: "Failed to update car" });
    }
  },
  getCarById: async (req, res) => {
    try {
      const carId = req.params.id;
      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({ message: "Car not found" });
      }

      res.status(200).json(car.toObject({ virtuals: true }));
    } catch (error) {
      console.error("Error fetching car details:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = carController;
