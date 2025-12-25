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

const paymentHistorySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { _id: true, timestamps: true }
);

const installmentSchema = new mongoose.Schema(
  {
    downPayment: { type: Number, required: true, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    months: { type: Number, required: true, min: 1 },
    monthlyPayment: { type: Number, min: 0 },
    buyer: { type: buyerSchema, required: true },
    startDate: { type: Date, required: true, default: Date.now },
    paymentHistory: { type: [paymentHistorySchema], default: [] },
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
      required: [true, "License number is required"],
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
      minlength: [2, "License number must be at least 2 characters"],
      maxlength: [20, "License number cannot exceed 20 characters"],
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
    model: {
      type: String,
      required: [true, "Model is required"],
      trim: true,
      maxlength: 100,
    },
    enginePower: {
      type: String,
      required: [true, "Engine power is required"],
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
      required: [true, "Color is required"],
      trim: true,
      maxlength: 50,
    },
    images: {
      type: [
        {
          url: { type: String, required: true },
          public_id: { type: String, required: true },
        },
      ],
      default: [],
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
    // For installment sales, `remainingAmount` represents the total remaining
    // amount to be paid (not the monthly installment). The total incoming
    // amount from the buyer is therefore:
    //   downPayment + remainingAmount
    const downPayment = this.installment.downPayment || 0;
    const remainingAmount = this.installment.remainingAmount || 0;

    const totalInstallment = downPayment + remainingAmount;
    return totalInstallment - (this.purchasePrice + totalRepairs);
  }

  return null;
});

carSchema.virtual("status").get(function () {
  if (!this.isAvailable) return "Inactive";
  return "Active";
});

// =======================
// Installment Payment Tracking Virtuals
// =======================
carSchema.virtual("installmentPaidAmount").get(function () {
  if (!this.installment) return null;
  const paymentHistoryTotal =
    (this.installment.paymentHistory || []).reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );
  return (this.installment.downPayment || 0) + paymentHistoryTotal;
});

carSchema.virtual("installmentTotalAmount").get(function () {
  if (!this.installment) return null;
  // Total amount = downPayment + current remainingAmount + all payments made
  // This equals the original total (downPayment + original remainingAmount)
  const paymentHistoryTotal =
    (this.installment.paymentHistory || []).reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );
  return (
    (this.installment.downPayment || 0) +
    (this.installment.remainingAmount || 0) +
    paymentHistoryTotal
  );
});

carSchema.virtual("installmentPaymentProgress").get(function () {
  if (!this.installment) return null;
  const total = this.installmentTotalAmount || 0;
  const paid = this.installmentPaidAmount || 0;
  if (total === 0) return 0;
  return Math.min((paid / total) * 100, 100);
});

carSchema.virtual("installmentMonthlyPayment").get(function () {
  if (!this.installment || !this.installment.monthlyPayment) return null;
  return this.installment.monthlyPayment;
});

carSchema.virtual("installmentIsFullyPaid").get(function () {
  if (!this.installment) return null;
  return (this.installment.remainingAmount || 0) <= 0;
});

// carSchema.virtual("daysInInventory").get(function () {
//   const endDate = this.sale?.date || new Date();
//   return Math.floor((endDate - this.createdAt) / (1000 * 60 * 60 * 24));
// });

// =======================
// Middleware
// =======================
carSchema.pre("validate", function (next) {
  const sold = !!this.sale || !!this.installment;

  if (sold && this.isAvailable) {
    this.isAvailable = false;
  }

  next();
});

carSchema.pre("save", function (next) {
  if (this.sale) {
    this.isAvailable = false;
    this.boughtType = "Paid";
  } else if (this.installment) {
    this.isAvailable = false;
    this.boughtType = "Installment";
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
  monthlyPayment,
  // updatedBy,
}) {
  if (
    downPayment == null ||
    remainingAmount == null ||
    months == null ||
    monthlyPayment == null ||
    !months ||
    !buyer?.name
  ) {
    throw new Error(
      "Installment requires downPayment, remainingAmount, months, monthlyPayment, and buyer.name"
    );
  }

  this.installment = {
    downPayment: Number(downPayment),
    remainingAmount: Number(remainingAmount),
    months: Number(months),
    monthlyPayment: Number(monthlyPayment),
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

// Add payment to installment
carSchema.methods.addInstallmentPayment = function (amount, paymentDate, notes) {
  if (!this.installment) {
    throw new Error("Car is not sold on installment");
  }

  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Payment amount must be a valid positive number");
  }

  if (paymentAmount > this.installment.remainingAmount) {
    throw new Error(
      `Payment amount (${paymentAmount}) exceeds remaining amount (${this.installment.remainingAmount})`
    );
  }

  // Add payment to history
  this.installment.paymentHistory.push({
    amount: paymentAmount,
    paymentDate: paymentDate || new Date(),
    notes: notes || "",
  });

  // Update remaining amount
  this.installment.remainingAmount = Math.max(
    0,
    this.installment.remainingAmount - paymentAmount
  );

  return this;
};

// =======================
// Model
// =======================
const Car = mongoose.model("Car", carSchema);
module.exports = Car;
