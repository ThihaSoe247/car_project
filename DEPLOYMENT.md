# Deployment Checklist for Render

## Pre-Deployment Checklist

### ✅ Code Quality
- [x] Error handling middleware implemented
- [x] Input validation added to all routes
- [x] Security middleware (helmet, rate limiting) configured
- [x] CORS properly configured
- [x] Health check endpoint implemented
- [x] Graceful shutdown handlers added
- [x] Environment variables properly configured

### ✅ Production Configuration
- [x] `package.json` updated with production scripts
- [x] `render.yaml` configuration file created
- [x] Environment example file provided
- [x] README.md with deployment instructions
- [x] Node.js version specified in package.json

### ✅ Security
- [x] JWT secret will be set as environment variable
- [x] MongoDB connection string will be secured
- [x] CORS origins will be restricted to production domains
- [x] Rate limiting configured for auth endpoints
- [x] Security headers implemented

## Render Deployment Steps

### 1. Prepare Your Repository
```bash
# Ensure all changes are committed
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### 2. Set Up MongoDB Database
1. **Create MongoDB Atlas cluster** (recommended for production)
   - Go to [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a new cluster
   - Set up database access (username/password)
   - Set up network access (IP whitelist or 0.0.0.0/0 for Render)
   - Get your connection string

2. **Alternative: Use Render's MongoDB service**
   - Create a new MongoDB service in Render
   - Use the provided connection string

### 3. Deploy on Render

#### Option A: Using render.yaml (Recommended)
1. **Connect your GitHub repository to Render**
2. **Render will automatically detect the `render.yaml` file**
3. **Set environment variables in Render dashboard:**
   ```
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/car-showroom
   JWT_SECRET=your-super-secure-jwt-secret-key-here
   ALLOWED_ORIGINS=https://your-frontend-domain.com
   ```

#### Option B: Manual Setup
1. **Create a new Web Service**
2. **Connect your GitHub repository**
3. **Configure settings:**
   - **Name**: `car-showroom-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. **Set environment variables**
5. **Deploy**

### 4. Environment Variables for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `10000` (Render default) |
| `MONGO_URL` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://yourdomain.com` |

### 5. Post-Deployment Verification

1. **Check Health Endpoint**
   ```bash
   curl https://your-app-name.onrender.com/health
   ```

2. **Test API Endpoints**
   ```bash
   # Test root endpoint
   curl https://your-app-name.onrender.com/
   
   # Test registration (should return validation error)
   curl -X POST https://your-app-name.onrender.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@test.com","password":"123"}'
   ```

3. **Monitor Logs**
   - Check Render dashboard for any errors
   - Monitor application logs for issues

### 6. Frontend Integration

Update your frontend application to use the new API URL:

```javascript
// Development
const API_URL = 'http://localhost:4000/api';

// Production
const API_URL = 'https://your-app-name.onrender.com/api';
```

### 7. SSL and Domain Setup

- Render automatically provides SSL certificates
- Custom domains can be configured in Render dashboard
- Update `ALLOWED_ORIGINS` to include your custom domain

## Monitoring and Maintenance

### Health Monitoring
- Use the `/health` endpoint for monitoring
- Set up uptime monitoring services
- Monitor Render dashboard for performance

### Logs and Debugging
- Check Render logs for errors
- Use structured logging for better debugging
- Monitor MongoDB connection status

### Performance Optimization
- Monitor response times
- Check database query performance
- Optimize images and file uploads if needed

### Security Updates
- Regularly update dependencies
- Monitor security advisories
- Rotate JWT secrets periodically

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are in package.json
   - Check for syntax errors

2. **Database Connection Issues**
   - Verify MongoDB connection string
   - Check network access settings
   - Ensure database credentials are correct

3. **CORS Errors**
   - Update `ALLOWED_ORIGINS` with correct frontend URL
   - Check for typos in domain names

4. **Authentication Issues**
   - Verify JWT_SECRET is set correctly
   - Check token expiration settings
   - Ensure proper Authorization headers

### Support Resources
- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practices-performance.html)

## Cost Optimization

### Render Free Tier Limits
- 750 hours per month
- 512 MB RAM
- Shared CPU
- Automatic sleep after 15 minutes of inactivity

### Upgrade Considerations
- Monitor usage and performance
- Consider paid plans for production workloads
- Optimize database queries for cost efficiency
