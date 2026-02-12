const express = require("express");
const router = express.Router();
const generalExpenseController = require("../controllers/general-expense-controller");
const { protect } = require("../controllers/auth-controller");

// All routes require authentication
router.use(protect);

// Create a new general expense
// POST /api/general-expenses
router.post("/", generalExpenseController.createGeneralExpense);

// Get all general expenses with optional filtering
// GET /api/general-expenses?startDate=2024-01-01&endDate=2024-12-31&page=1&limit=50
router.get("/", generalExpenseController.getAllGeneralExpenses);

// Get general expenses by period
// GET /api/general-expenses/period?period=monthly|6months|yearly
router.get("/period", generalExpenseController.getGeneralExpensesByPeriod);

// Get a single general expense by ID
// GET /api/general-expenses/:id
router.get("/:id", generalExpenseController.getGeneralExpenseById);

// Update a general expense
// PUT /api/general-expenses/:id
router.put("/:id", generalExpenseController.updateGeneralExpense);

// Delete a general expense
// DELETE /api/general-expenses/:id
router.delete("/:id", generalExpenseController.deleteGeneralExpense);

module.exports = router;
