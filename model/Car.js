const mongoose = require("mongoose");

// =======================
// Sub Schemas
// =======================

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
    phone: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^[\+]?[1-9][\d]{0,15}$/.test(v);
        },
        message: "Please provide a valid phone number",
      },
    },
    email: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please provide a valid email address",
      },
    },
    passport: {
      type: String,
      required: [true, "Passport is required"],
      trim: true,
    },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    price: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    kiloAtSale: { type: Number, required: true, min: 0 },
    buyer: { type: buyerSchema, required: true },
  },
  { _id: false }
);

const installmentSchema = new mongoose.Schema(
  {
    downPayment: { type: Number, required: true, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    months: { type: Number, required: true, min: 1 },
    buyer: { type: buyerSchema, required: true },
    startDate: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

// =======================
// Car Schema
// =======================

const carSchema = new mongoose.Schema(
  {
    licenseNo: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    year: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 1,
    },
    enginePower: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    gear: {
      type: String,
      enum: ["Manual", "Automatic"],
      required: true,
    },
    color: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    images: {
      type: [String],
      validate: {
        validator: function (arr) {
          return arr.length <= 20;
        },
        message: "Cannot have more than 20 images",
      },
    },
    kilo: {
      type: Number,
      required: true,
      min: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    wheelDrive: {
      type: String,
      enum: ["FWD", "RWD", "4WD", "AWD"],
      required: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    priceToSell: {
      type: Number,
      required: true,
      min: 0,
    },

    // New field: Paid or Installment
    boughtType: {
      type: String,
      enum: ["Paid", "Installment", null],
      default: null,
    },

    // Sale info (Paid)
    sale: {
      type: saleSchema,
      default: null,
    },

    // Installment info
    installment: {
      type: installmentSchema,
      default: null,
    },

    // Legacy fields
    resellPrice: { type: Number },
    soldOutDate: { type: Date },

    repairs: {
      type: [repairSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// =======================
// Indexes
// =======================
carSchema.index({ isAvailable: 1, createdAt: -1 });
carSchema.index({ brand: 1 });
carSchema.index({ year: 1 });
carSchema.index({ "sale.date": -1 });
carSchema.index({ licenseNo: 1 });
// carSchema.index({ createdBy: 1 });

// =======================
// Virtuals
// =======================
carSchema.virtual("totalRepairCost").get(function () {
  return (this.repairs || []).reduce((sum, r) => sum + (r.cost || 0), 0);
});
carSchema.virtual("profit").get(function () {
  const totalRepairs = this.totalRepairCost || 0;

  // Case 1: Paid sale
  if (this.sale?.price && this.purchasePrice != null) {
    return this.sale.price - (this.purchasePrice + totalRepairs);
  }

  // Case 2: Installment sale
  if (this.installment && this.purchasePrice != null) {
    const totalInstallment =
      (this.installment.downPayment || 0) +
      (this.installment.remainingAmount || 0);
    return totalInstallment - (this.purchasePrice + totalRepairs);
  }

  return null;
});

carSchema.virtual("status").get(function () {
  if (!this.isAvailable) return "Inactive";
  return "Active";
});

carSchema.virtual("daysInInventory").get(function () {
  const endDate = this.sale?.date || new Date();
  return Math.floor((endDate - this.createdAt) / (1000 * 60 * 60 * 24));
});

// =======================
// Middleware
// =======================
carSchema.pre("validate", function (next) {
  const sold = !!this.sale || !!this.installment;

  if (sold && this.isAvailable) {
    this.isAvailable = false;
  }

  if (!sold && this.isAvailable === true) {
    this.resellPrice = null;
    this.soldOutDate = null;
  }

  next();
});

carSchema.pre("save", function (next) {
  if (this.sale) {
    this.isAvailable = false;
    this.boughtType = "Paid";
    this.resellPrice = this.sale.price;
    this.soldOutDate = this.sale.date;
  } else if (this.installment) {
    this.isAvailable = false;
    this.boughtType = "Installment";
    this.resellPrice =
      this.installment.downPayment + this.installment.remainingAmount;
    this.soldOutDate = this.installment.startDate;
  }

  // if (this.isModified() && !this.updatedBy) {
  //   this.updatedBy = this.createdBy;
  // }

  next();
});

// =======================
// Instance Methods
// =======================
carSchema.methods.markAsPaid = function ({
  price,
  date,
  kiloAtSale,
  buyer,
  updatedBy,
}) {
  if (!price || !date || !kiloAtSale || !buyer?.name) {
    throw new Error(
      "Paid sale requires price, date, kiloAtSale, and buyer.name"
    );
  }

  this.sale = { price, date, kiloAtSale, buyer };
  this.installment = null;
  this.boughtType = "Paid";
  this.isAvailable = false;
  // this.updatedBy = updatedBy;

  if (this.kilo < Number(kiloAtSale)) {
    this.kilo = Number(kiloAtSale);
  }
};

carSchema.methods.markAsInstallment = function ({
  downPayment,
  remainingAmount,
  months,
  buyer,
  startDate,
  // updatedBy,
}) {
  if (
    downPayment == null ||
    remainingAmount == null ||
    !months ||
    !buyer?.name
  ) {
    throw new Error(
      "Installment requires downPayment, remainingAmount, months, and buyer.name"
    );
  }

  this.installment = {
    downPayment: Number(downPayment),
    remainingAmount: Number(remainingAmount),
    months: Number(months),
    buyer,
    startDate: startDate || new Date(),
  };
  this.sale = null;
  this.boughtType = "Installment";
  this.isAvailable = false;
  // this.updatedBy = updatedBy;
};

carSchema.methods.relist = function (updatedBy) {
  this.sale = null;
  this.installment = null;
  this.boughtType = null;
  this.isAvailable = true;
  // this.updatedBy = updatedBy;
};

// =======================
// Model
// =======================
const Car = mongoose.model("Car", carSchema);
module.exports = Car;
