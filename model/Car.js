const mongoose = require("mongoose");

const repairSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    },
    repairDate: {
      type: Date,
      required: true,
    },
    cost: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const carSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  fuelType: {
    type: String,
    enum: ["Petrol", "Diesel", "Electric", "Hybrid", "CNG"],
    required: true,
  },
  transmission: {
    type: String,
    enum: ["Manual", "Automatic"],
    required: true,
  },
  color: String,
  mileage: Number,
  images: [String],
  isAvailable: { type: Boolean, default: true },
  licenseNo: { type: String },
  enginePower: { type: String },
  wheelDrive: { type: String },

  showroomBoughtDate: { type: Date, required: true },
  boughtPrice: { type: Number, required: true },
  priceToSell: {
    type: Number,
    required: true,
  },
  resellPrice: { type: Number },
  soldOutDate: { type: Date },

  repairs: [repairSchema],

  createdAt: { type: Date, default: Date.now },
});

carSchema.virtual("totalRepairCost").get(function () {
  return this.repairs.reduce((sum, r) => sum + r.cost, 0);
});

carSchema.virtual("profit").get(function () {
  if (this.resellPrice != null && this.boughtPrice != null) {
    return this.resellPrice - (this.boughtPrice + this.totalRepairCost);
  }
  return null;
});

carSchema.set("toJSON", { virtuals: true });
carSchema.set("toObject", { virtuals: true });

const Car = mongoose.model("Car", carSchema);
module.exports = Car;
