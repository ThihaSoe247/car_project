const axios = require('axios');

const BASE_URL = 'http://localhost:4000';

async function testServer() {
  console.log('🧪 Testing Car Showroom Backend API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);

    // Test root endpoint
    console.log('\n2. Testing root endpoint...');
    const rootResponse = await axios.get(`${BASE_URL}/`);
    console.log('✅ Root endpoint working:', rootResponse.data);

    // Test 404 endpoint
    console.log('\n3. Testing 404 handling...');
    try {
      await axios.get(`${BASE_URL}/nonexistent`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ 404 handling working correctly');
      } else {
        throw error;
      }
    }

    // Test authentication endpoints (without validation)
    console.log('\n4. Testing authentication endpoints...');
    try {
      await axios.post(`${BASE_URL}/api/auth/register`, {
        name: 'Test User',
        email: 'test@example.com',
        password: '123456'
      });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Registration validation working (expected error for duplicate user)');
      } else {
        console.log('⚠️ Registration endpoint response:', error.response?.status);
      }
    }

    console.log('\n🎉 All basic tests completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Set up your .env file with proper configuration');
    console.log('2. Ensure MongoDB is running and accessible');
    console.log('3. Test with a real frontend application');
    console.log('4. Deploy to Render using the provided configuration');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running with: npm run dev');
    }
  }
}

testServer();
