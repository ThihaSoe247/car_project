# General Expenses API Documentation

## Overview
The General Expenses feature allows you to track business-wide expenses (rent, utilities, salaries, etc.) and calculate net profit by subtracting these expenses from your gross profit from car sales.

## Data Model

### GeneralExpense Schema
```javascript
{
  title: String (required, max 200 chars),
  description: String (optional, max 1000 chars),
  amount: Number (required, min 0),
  expenseDate: Date (required, defaults to now),
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

## API Endpoints

All endpoints require JWT authentication via Bearer token.

### 1. Create General Expense
**POST** `/api/general-expenses`

**Request Body:**
```json
{
  "title": "Office Rent - February 2026",
  "description": "Monthly office rent payment",
  "amount": 500000,
  "expenseDate": "2026-02-01"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "General expense created successfully",
  "data": {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "title": "Office Rent - February 2026",
    "description": "Monthly office rent payment",
    "amount": 500000,
    "expenseDate": "2026-02-01T00:00:00.000Z",
    "createdAt": "2026-02-13T02:59:22.000Z",
    "updatedAt": "2026-02-13T02:59:22.000Z"
  }
}
```

---

### 2. Get All General Expenses
**GET** `/api/general-expenses`

**Query Parameters:**
- `startDate` (optional): Filter expenses from this date (ISO format)
- `endDate` (optional): Filter expenses until this date (ISO format)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Example:**
```
GET /api/general-expenses?startDate=2026-01-01&endDate=2026-02-28&page=1&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "title": "Office Rent - February 2026",
      "description": "Monthly office rent payment",
      "amount": 500000,
      "expenseDate": "2026-02-01T00:00:00.000Z",
      "createdAt": "2026-02-13T02:59:22.000Z",
      "updatedAt": "2026-02-13T02:59:22.000Z"
    }
  ],
  "summary": {
    "totalAmount": 500000,
    "count": 1
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

---

### 3. Get General Expenses by Period
**GET** `/api/general-expenses/period`

**Query Parameters:**
- `period` (required): One of `monthly`, `6months`, or `yearly`

**Example:**
```
GET /api/general-expenses/period?period=monthly
```

**Response (200):**
```json
{
  "success": true,
  "period": "monthly",
  "dateRange": {
    "startDate": "2026-02-01T00:00:00.000Z",
    "endDate": "2026-02-13T02:59:22.000Z"
  },
  "summary": {
    "totalAmount": 1500000,
    "count": 3
  },
  "data": [...]
}
```

---

### 4. Get Single General Expense
**GET** `/api/general-expenses/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "title": "Office Rent - February 2026",
    "description": "Monthly office rent payment",
    "amount": 500000,
    "expenseDate": "2026-02-01T00:00:00.000Z",
    "createdAt": "2026-02-13T02:59:22.000Z",
    "updatedAt": "2026-02-13T02:59:22.000Z"
  }
}
```

---

### 5. Update General Expense
**PUT** `/api/general-expenses/:id`

**Request Body (all fields optional):**
```json
{
  "title": "Office Rent - February 2026 (Updated)",
  "description": "Updated description",
  "amount": 550000,
  "expenseDate": "2026-02-01"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "General expense updated successfully",
  "data": {...}
}
```

---

### 6. Delete General Expense
**DELETE** `/api/general-expenses/:id`

**Response (200):**
```json
{
  "success": true,
  "message": "General expense deleted successfully",
  "data": {...}
}
```

---

## Net Profit Analysis

### Get Net Profit Analysis
**GET** `/api/analysis/profit/net`

This endpoint calculates net profit by subtracting general expenses from gross profit.

**Query Parameters:**
- `period` (required): One of `monthly`, `6months`, or `yearly`

**Example:**
```
GET /api/analysis/profit/net?period=monthly
```

**Response (200):**
```json
{
  "success": true,
  "period": "monthly",
  "dateRange": {
    "startDate": "2026-02-01T00:00:00.000Z",
    "endDate": "2026-02-13T02:59:22.000Z"
  },
  "summary": {
    "totalGrossProfit": 10000000,
    "totalGeneralExpenses": 2000000,
    "netProfit": 8000000,
    "paidSales": {
      "count": 3,
      "grossProfit": 4000000
    },
    "installmentSales": {
      "count": 2,
      "generalProfit": 5000000,
      "detailedProfit": 6000000,
      "actualInstallmentProfit": 1000000
    }
  },
  "carSales": {
    "paid": [...],
    "installment": [...]
  },
  "generalExpenses": [...]
}
```

### Understanding the Metrics:

1. **totalGrossProfit**: Total profit from all car sales (paid + installment detailed profit)
2. **totalGeneralExpenses**: Sum of all business expenses for the period
3. **netProfit**: `totalGrossProfit - totalGeneralExpenses` (your actual profit after expenses)
4. **paidSales.grossProfit**: Profit from paid sales only
5. **installmentSales.generalProfit**: Base profit on installment cars (car price - costs)
6. **installmentSales.detailedProfit**: Total profit including financing income
7. **installmentSales.actualInstallmentProfit**: Additional profit from financing (detailedProfit - generalProfit)

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Title is required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "General expense not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to create general expense"
}
```

## Usage Examples

### Example 1: Track Monthly Expenses
```javascript
// Add rent expense
POST /api/general-expenses
{
  "title": "Office Rent - February",
  "amount": 500000,
  "expenseDate": "2026-02-01"
}

// Add utilities
POST /api/general-expenses
{
  "title": "Electricity & Water",
  "amount": 150000,
  "expenseDate": "2026-02-05"
}

// Add salaries
POST /api/general-expenses
{
  "title": "Employee Salaries",
  "amount": 1000000,
  "expenseDate": "2026-02-01"
}
```

### Example 2: Calculate Monthly Net Profit
```javascript
// Get net profit for current month
GET /api/analysis/profit/net?period=monthly

// Response shows:
// - Gross profit from car sales: 10,000,000
// - General expenses: 1,650,000
// - Net profit: 8,350,000
```

### Example 3: Review Yearly Performance
```javascript
// Get all expenses for the year
GET /api/general-expenses/period?period=yearly

// Get net profit for the year
GET /api/analysis/profit/net?period=yearly
```

## Best Practices

1. **Consistent Categorization**: Use clear, consistent titles for similar expenses
2. **Regular Updates**: Record expenses as they occur
3. **Date Accuracy**: Use the actual expense date, not the recording date
4. **Detailed Descriptions**: Add context in the description field for future reference
5. **Period Analysis**: Regularly review net profit to understand business performance

## Integration Notes

- All endpoints require JWT Bearer token authentication
- Only Admin and Moderator roles can access profit analysis endpoints
- Dates are stored in UTC and should be provided in ISO 8601 format
- Amounts are stored as numbers (no currency symbol)
- The system automatically indexes expenses by date for efficient querying
