const GeneralExpense = require("../model/GeneralExpense");
const mongoose = require("mongoose");

// Helper function to sanitize MongoDB ObjectId
const sanitizeId = (id) => {
    if (!id) return null;
    return id.toString().trim();
};

// Helper function to parse date
const toDate = (dateInput) => {
    if (!dateInput) return null;
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const generalExpenseController = {
    // Create a new general expense
    createGeneralExpense: async (req, res) => {
        try {
            const { title, description, amount, expenseDate } = req.body;

            // Validate required fields
            if (!title || title.trim() === "") {
                return res.status(400).json({
                    success: false,
                    message: "Title is required",
                });
            }

            if (amount === undefined || amount === null) {
                return res.status(400).json({
                    success: false,
                    message: "Amount is required",
                });
            }

            const expenseAmount = Number(amount);
            if (isNaN(expenseAmount) || expenseAmount < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Amount must be a positive number",
                });
            }

            // Parse expense date
            let parsedExpenseDate = expenseDate ? toDate(expenseDate) : new Date();
            if (expenseDate && !parsedExpenseDate) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expense date format",
                });
            }

            // Create new expense
            const newExpense = new GeneralExpense({
                title: title.trim(),
                description: description ? description.trim() : "",
                amount: expenseAmount,
                expenseDate: parsedExpenseDate,
            });

            const savedExpense = await newExpense.save();

            return res.status(201).json({
                success: true,
                message: "General expense created successfully",
                data: savedExpense,
            });
        } catch (error) {
            console.error("Error creating general expense:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to create general expense",
            });
        }
    },

    // Get all general expenses with optional date filtering
    getAllGeneralExpenses: async (req, res) => {
        try {
            const { startDate, endDate, page = 1, limit = 50 } = req.query;

            // Build filter
            const filter = {};

            if (startDate || endDate) {
                filter.expenseDate = {};
                if (startDate) {
                    const parsedStartDate = toDate(startDate);
                    if (!parsedStartDate) {
                        return res.status(400).json({
                            success: false,
                            message: "Invalid startDate format",
                        });
                    }
                    filter.expenseDate.$gte = parsedStartDate;
                }
                if (endDate) {
                    const parsedEndDate = toDate(endDate);
                    if (!parsedEndDate) {
                        return res.status(400).json({
                            success: false,
                            message: "Invalid endDate format",
                        });
                    }
                    filter.expenseDate.$lte = parsedEndDate;
                }
            }

            // Pagination
            const pageNum = Math.max(parseInt(page) || 1, 1);
            const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
            const skip = (pageNum - 1) * limitNum;

            const [expenses, total] = await Promise.all([
                GeneralExpense.find(filter)
                    .sort({ expenseDate: -1, createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                GeneralExpense.countDocuments(filter),
            ]);

            // Calculate total amount for filtered expenses
            const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

            return res.status(200).json({
                success: true,
                data: expenses,
                summary: {
                    totalAmount,
                    count: expenses.length,
                },
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            });
        } catch (error) {
            console.error("Error fetching general expenses:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch general expenses",
            });
        }
    },

    // Get general expenses by period (monthly, 6months, yearly)
    getGeneralExpensesByPeriod: async (req, res) => {
        try {
            const { period } = req.query;

            // Validate period parameter
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: "Period query parameter is required (monthly | 6months | yearly)",
                });
            }

            const validPeriods = ["monthly", "6months", "yearly"];
            if (!validPeriods.includes(period)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid period. Must be one of: monthly, 6months, yearly",
                });
            }

            // Calculate date range
            const now = new Date();
            let startDate;

            if (period === "monthly") {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (period === "6months") {
                startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            } else if (period === "yearly") {
                startDate = new Date(now.getFullYear(), 0, 1);
            }

            // Fetch expenses for the period
            const expenses = await GeneralExpense.find({
                expenseDate: { $gte: startDate, $lte: now },
            }).sort({ expenseDate: -1 });

            // Calculate total
            const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

            return res.status(200).json({
                success: true,
                period,
                dateRange: {
                    startDate,
                    endDate: now,
                },
                summary: {
                    totalAmount,
                    count: expenses.length,
                },
                data: expenses,
            });
        } catch (error) {
            console.error("Error fetching general expenses by period:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch general expenses",
            });
        }
    },

    // Get a single general expense by ID
    getGeneralExpenseById: async (req, res) => {
        try {
            const expenseId = sanitizeId(req.params.id);

            if (!mongoose.Types.ObjectId.isValid(expenseId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expense ID",
                });
            }

            const expense = await GeneralExpense.findById(expenseId);

            if (!expense) {
                return res.status(404).json({
                    success: false,
                    message: "General expense not found",
                });
            }

            return res.status(200).json({
                success: true,
                data: expense,
            });
        } catch (error) {
            console.error("Error fetching general expense:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch general expense",
            });
        }
    },

    // Update a general expense
    updateGeneralExpense: async (req, res) => {
        try {
            const expenseId = sanitizeId(req.params.id);

            if (!mongoose.Types.ObjectId.isValid(expenseId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expense ID",
                });
            }

            const { title, description, amount, expenseDate } = req.body;

            // Build update object
            const updateData = {};

            if (title !== undefined) {
                if (!title || title.trim() === "") {
                    return res.status(400).json({
                        success: false,
                        message: "Title cannot be empty",
                    });
                }
                updateData.title = title.trim();
            }

            if (description !== undefined) {
                updateData.description = description ? description.trim() : "";
            }

            if (amount !== undefined) {
                const expenseAmount = Number(amount);
                if (isNaN(expenseAmount) || expenseAmount < 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Amount must be a positive number",
                    });
                }
                updateData.amount = expenseAmount;
            }

            if (expenseDate !== undefined) {
                const parsedExpenseDate = toDate(expenseDate);
                if (!parsedExpenseDate) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid expense date format",
                    });
                }
                updateData.expenseDate = parsedExpenseDate;
            }

            const updatedExpense = await GeneralExpense.findByIdAndUpdate(
                expenseId,
                updateData,
                { new: true, runValidators: true }
            );

            if (!updatedExpense) {
                return res.status(404).json({
                    success: false,
                    message: "General expense not found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "General expense updated successfully",
                data: updatedExpense,
            });
        } catch (error) {
            console.error("Error updating general expense:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to update general expense",
            });
        }
    },

    // Delete a general expense
    deleteGeneralExpense: async (req, res) => {
        try {
            const expenseId = sanitizeId(req.params.id);

            if (!mongoose.Types.ObjectId.isValid(expenseId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expense ID",
                });
            }

            const deletedExpense = await GeneralExpense.findByIdAndDelete(expenseId);

            if (!deletedExpense) {
                return res.status(404).json({
                    success: false,
                    message: "General expense not found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "General expense deleted successfully",
                data: deletedExpense,
            });
        } catch (error) {
            console.error("Error deleting general expense:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to delete general expense",
            });
        }
    },
};

module.exports = generalExpenseController;
