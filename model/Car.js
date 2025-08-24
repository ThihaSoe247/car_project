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
    phone: { 
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^[\+]?[1-9][\d]{0,15}$/.test(v);
        },
        message: 'Please provide a valid phone number'
      }
    },
    email: { 
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please provide a valid email address'
      }
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

const carSchema = new mongoose.Schema({
  licenseNo: { 
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  brand: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  year: { 
    type: Number, 
    required: true,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  enginePower: { 
    type: String,
    trim: true,
    maxlength: 100
  },
  gear: { 
    type: String, 
    enum: ["Manual", "Automatic"], 
    required: true 
  },
  color: { 
    type: String,
    trim: true,
    maxlength: 50
  },
  images: [{ 
    type: String,
    validate: {
      validator: function(v) {
        return v.length <= 10; // Max 10 images
      },
      message: 'Cannot have more than 10 images'
    }
  }],
  kilo: { 
    type: Number, 
    required: true,
    min: 0
  },
  isAvailable: { 
    type: Boolean, 
    default: true 
  },
  wheelDrive: {
    type: String,
    enum: ["FWD", "RWD", "4WD", "AWD"],
    required: true,
  },
  purchaseDate: { 
    type: Date, 
    required: true 
  },
  purchasePrice: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  priceToSell: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  sale: { 
    type: saleSchema, 
    default: null 
  },
  repairs: { 
    type: [repairSchema], 
    default: [] 
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
carSchema.index({ isAvailable: 1, createdAt: -1 });
carSchema.index({ brand: 1 });
carSchema.index({ year: 1 });
carSchema.index({ 'sale.date': -1 });
carSchema.index({ licenseNo: 1 });
carSchema.index({ createdBy: 1 });

// Virtuals
carSchema.virtual("totalRepairCost").get(function () {
  return (this.repairs || []).reduce((sum, r) => sum + (r.cost || 0), 0);
});

carSchema.virtual("profit").get(function () {
  if (this.sale?.price && this.purchasePrice) {
    return this.sale.price - (this.purchasePrice + this.totalRepairCost);
  }
  return null;
});

carSchema.virtual("daysInInventory").get(function () {
  if (this.isAvailable) {
    return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Pre-save middleware for data consistency
carSchema.pre("save", function (next) {
  // Update isAvailable based on sale status
  if (this.sale) {
    this.isAvailable = false;
  }
  
  // Update updatedBy if not set
  if (this.isModified() && !this.updatedBy) {
    this.updatedBy = this.createdBy;
  }
  
  next();
});

// Instance methods
carSchema.methods.markAsSold = function ({ price, date, kiloAtSale, buyer, updatedBy }) {
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
  this.updatedBy = updatedBy;

  // Update latest odometer if higher
  if (this.kilo < Number(kiloAtSale)) {
    this.kilo = Number(kiloAtSale);
  }
};

carSchema.methods.relist = function (updatedBy) {
  this.sale = null;
  this.isAvailable = true;
  this.updatedBy = updatedBy;
};

const Car = mongoose.model("Car", carSchema);
module.exports = Car;
