const { testProfitCalculations, testCases, manualProfitCalculation } = require('./profit.test');

console.log('🚀 Starting Profit Calculation Tests...\n');

// Run the tests
testProfitCalculations().then(() => {
  console.log('\n📋 Manual Verification Summary:');
  console.log('=' .repeat(50));
  
  testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}`);
    const manual = manualProfitCalculation(testCase.car);
    console.log(`   Manual Calculation: $${manual.profit?.toLocaleString() || 'N/A'}`);
    console.log(`   Expected: $${testCase.expected.generalProfit.toLocaleString()}`);
    console.log(`   Match: ${manual.profit === testCase.expected.generalProfit ? '✅' : '❌'}`);
  });
  
  console.log('\n✨ Test execution completed!');
}).catch(error => {
  console.error('❌ Test execution failed:', error);
});
