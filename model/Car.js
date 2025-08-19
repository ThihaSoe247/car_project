const mongoose = require("mongoose");

const repairSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    repairDate: { type: Date, required: true },
    cost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const buyerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String }, // optional format validation if you want
    email: { type: String }, // optional regex/email validator
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    price: { type: Number, required: true, min: 0 }, // car price at sale
    date: { type: Date, required: true }, // sold date
    kiloAtSale: { type: Number, required: true, min: 0 }, // odometer at sale
    buyer: { type: buyerSchema, required: true },
  },
  { _id: false }
);

const carSchema = new mongoose.Schema({
  licenseNo: { type: String },
  brand: { type: String, required: true },
  year: { type: Number, required: true },
  enginePower: { type: String },
  gear: { type: String, enum: ["Manual", "Automatic"], required: true },
  color: String,
  images: [String],
  kilo: { type: Number, required: true }, // current/last-known odometer
  isAvailable: { type: Boolean, default: true },
  wheelDrive: {
    type: String,
    enum: ["FWD", "RWD", "4WD", "AWD"],
    required: true,
  },

  purchaseDate: { type: Date, required: true },
  purchasePrice: { type: Number, required: true, min: 0 },
  priceToSell: { type: Number, required: true, min: 0 },

  // Legacy single fields (kept for compatibility/queries)
  resellPrice: { type: Number },
  soldOutDate: { type: Date },

  // New: grouped sale data (present only when sold)
  sale: { type: saleSchema, default: null },

  repairs: { type: [repairSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

// Virtuals
carSchema.virtual("totalRepairCost").get(function () {
  return (this.repairs || []).reduce((sum, r) => sum + (r.cost || 0), 0);
});

carSchema.virtual("profit").get(function () {
  const realized = this.sale?.price ?? this.resellPrice;
  if (realized != null && this.purchasePrice != null) {
    return realized - (this.purchasePrice + this.totalRepairCost);
  }
  return null;
});

// Consistency guardrails
carSchema.pre("validate", function (next) {
  const sold = !!this.sale;

  // If sold ⇒ must be unavailable; if available ⇒ sale cleared
  if (sold && this.isAvailable) this.isAvailable = false;
  if (!sold && this.isAvailable === true) {
    // ensure legacy sale fields aren’t leaking
    this.resellPrice = null;
    this.soldOutDate = null;
  }

  // Keep legacy fields in sync for older code/UI
  if (sold) {
    this.resellPrice = this.sale.price;
    this.soldOutDate = this.sale.date;
  }

  next();
});

// Convenience methods
carSchema.methods.markAsSold = function ({ price, date, kiloAtSale, buyer }) {
  if (price == null || !date || kiloAtSale == null || !buyer?.name) {
    throw new Error("Selling requires price, date, kiloAtSale, and buyer.name");
  }
  this.sale = {
    price: Number(price),
    date: new Date(date),
    kiloAtSale: Number(kiloAtSale),
    buyer: {
      name: buyer.name,
      phone: buyer.phone,
      email: buyer.email,
    },
  };
  this.isAvailable = false;

  // Optionally update latest odometer to the sold one
  if (this.kilo == null || this.kilo < Number(kiloAtSale)) {
    this.kilo = Number(kiloAtSale);
  }
};

carSchema.methods.relist = function () {
  this.sale = null;
  this.resellPrice = null;
  this.soldOutDate = null;
  this.isAvailable = true;
};

carSchema.set("toJSON", { virtuals: true });
carSchema.set("toObject", { virtuals: true });

const Car = mongoose.model("Car", carSchema);
module.exports = Car;
