const mongoose = require("mongoose");

// =======================
// General Expense Schema
// =======================

const generalExpenseSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
            maxlength: [200, "Title cannot exceed 200 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [1000, "Description cannot exceed 1000 characters"],
            default: "",
        },
        amount: {
            type: Number,
            required: [true, "Amount is required"],
            min: [0, "Amount must be a positive number"],
        },
        expenseDate: {
            type: Date,
            required: [true, "Expense date is required"],
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// =======================
// Indexes
// =======================
generalExpenseSchema.index({ expenseDate: -1 });
generalExpenseSchema.index({ createdAt: -1 });

// =======================
// Model
// =======================
const GeneralExpense = mongoose.model("GeneralExpense", generalExpenseSchema);
module.exports = GeneralExpense;
