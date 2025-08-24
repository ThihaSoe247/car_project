# Car Showroom Backend API

A robust Node.js/Express backend API for managing a car showroom with comprehensive car inventory, sales tracking, and user authentication.

## Features

- 🔐 JWT-based authentication with role-based access control
- 🚗 Complete car inventory management
- 💰 Sales tracking with profit calculations
- 🔧 Repair history tracking
- 📊 Advanced filtering and pagination
- 🛡️ Security features (rate limiting, input validation, CORS)
- 📝 Comprehensive error handling
- 🏥 Health check endpoints
- 🚀 Production-ready deployment configuration

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcryptjs, helmet, express-rate-limit
- **Validation**: express-validator
- **Logging**: Morgan

## Prerequisites

- Node.js 18.0.0 or higher
- MongoDB database (local or cloud)
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd car_project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   PORT=4000
   NODE_ENV=development
   MONGO_URL=mongodb://localhost:27017/car-showroom
   JWT_SECRET=your-super-secret-jwt-key-here
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Cars
- `GET /api/cars` - Get all cars
- `GET /api/cars/available` - Get available cars
- `GET /api/cars/sold` - Get sold cars (with pagination)
- `GET /api/car/:id` - Get car by ID
- `POST /api/create-car` - Create new car
- `PUT /api/car/:id/sell` - Mark car as sold
- `POST /api/cars/:carId/repairs` - Add repair record
- `PUT /api/car/:id/edit` - Edit car details
- `PUT /api/car/:id/edit-sale` - Edit sale information

### Health Check
- `GET /health` - Server health status

## Database Schema

### User Model
- `name` (String, required)
- `email` (String, required, unique)
- `password` (String, required, hashed)
- `role` (Enum: Admin, Staff, Moderator)

### Car Model
- `brand`, `year`, `enginePower`, `gear`, `color`
- `kilo` (odometer reading)
- `wheelDrive` (FWD, RWD, 4WD, AWD)
- `purchaseDate`, `purchasePrice`, `priceToSell`
- `isAvailable` (Boolean)
- `sale` (nested object with buyer info)
- `repairs` (array of repair records)
- Virtual fields: `totalRepairCost`, `profit`

## Security Features

- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configurable cross-origin requests
- **Security Headers**: Helmet.js for security headers
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcryptjs for password security

## Deployment on Render

### Option 1: Using render.yaml (Recommended)

1. **Push your code to GitHub**
2. **Connect your repository to Render**
3. **Render will automatically detect the `render.yaml` file**
4. **Set environment variables in Render dashboard:**
   - `MONGO_URL`: Your MongoDB connection string
   - `JWT_SECRET`: Your JWT secret key
   - `ALLOWED_ORIGINS`: Your frontend domain

### Option 2: Manual Setup

1. **Create a new Web Service on Render**
2. **Connect your GitHub repository**
3. **Configure build settings:**
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Set environment variables**
5. **Deploy**

### Environment Variables for Production

```env
NODE_ENV=production
PORT=10000
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/car-showroom
JWT_SECRET=your-production-jwt-secret
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

## Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build` - Build command (no build step required for Node.js)

### Project Structure

```
├── controllers/          # Route controllers
│   ├── auth-controller.js
│   └── car-controller.js
├── middleware/           # Custom middleware
│   ├── errorHandler.js
│   ├── security.js
│   └── validation.js
├── model/               # Database models
│   ├── User.js
│   └── Car.js
├── routes/              # API routes
│   ├── auth-routes.js
│   └── car-routes.js
├── server.js            # Main application file
├── package.json
├── render.yaml          # Render deployment config
└── README.md
```

## Error Handling

The API includes comprehensive error handling:

- **Validation Errors**: Detailed field-level validation messages
- **Authentication Errors**: Proper JWT validation
- **Database Errors**: Mongoose error handling
- **Rate Limiting**: Clear rate limit messages
- **404 Errors**: Route not found handling

## Monitoring

- **Health Check**: `/health` endpoint for monitoring
- **Logging**: Structured logging for production
- **Error Tracking**: Comprehensive error logging
- **Performance**: Request/response timing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC License

## Support

For support, please open an issue in the GitHub repository or contact the development team.
