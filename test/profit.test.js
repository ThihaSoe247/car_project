const mongoose = require('mongoose');
const Car = require('../model/Car');

// Test data for installment profit calculations
const testCases = [
  {
    name: "Just Started - Down Payment Only",
    car: {
      licenseNo: "TEST001",
      brand: "Toyota",
      model: "Camry",
      year: 2022,
      purchasePrice: 15000,
      priceToSell: 25000,
      isAvailable: false,
      boughtType: "Installment",
      repairs: [
        { cost: 1000, description: "Oil change" },
        { cost: 1000, description: "New tires" }
      ],
      installment: {
        downPayment: 5000,
        monthlyPayment: 2000,
        remainingAmount: 20000,
        startDate: new Date('2024-01-01'),
        paymentHistory: [] // No payments yet
      }
    },
    expected: {
      generalProfit: 8000,
      sellingPrice: 25000,
      soldPrice: 25000,
      totalPaid: 5000,
      remainingAmount: 20000
    }
  },
  {
    name: "Halfway Through - 3 Payments Made",
    car: {
      licenseNo: "TEST002",
      brand: "Honda",
      model: "Accord",
      year: 2023,
      purchasePrice: 15000,
      priceToSell: 25000,
      isAvailable: false,
      boughtType: "Installment",
      repairs: [
        { cost: 1000, description: "Oil change" },
        { cost: 1000, description: "New tires" }
      ],
      installment: {
        downPayment: 5000,
        monthlyPayment: 2000,
        remainingAmount: 14000, // 20,000 - 3×2,000 = 14,000
        startDate: new Date('2024-01-01'),
        paymentHistory: [
          { amount: 2000, date: new Date('2024-02-01'), paymentDate: new Date('2024-02-01') },
          { amount: 2000, date: new Date('2024-03-01'), paymentDate: new Date('2024-03-01') },
          { amount: 2000, date: new Date('2024-04-01'), paymentDate: new Date('2024-04-01') }
        ]
      }
    },
    expected: {
      generalProfit: 8000,
      sellingPrice: 25000,
      soldPrice: 25000,
      totalPaid: 11000, // 5,000 + 3×2,000 = 11,000
      remainingAmount: 14000
    }
  },
  {
    name: "Fully Paid - All Payments Complete",
    car: {
      licenseNo: "TEST003",
      brand: "Nissan",
      model: "Altima",
      year: 2021,
      purchasePrice: 15000,
      priceToSell: 25000,
      isAvailable: false,
      boughtType: "Installment",
      repairs: [
        { cost: 1000, description: "Oil change" },
        { cost: 1000, description: "New tires" }
      ],
      installment: {
        downPayment: 5000,
        monthlyPayment: 2000,
        remainingAmount: 0, // Fully paid
        startDate: new Date('2024-01-01'),
        paymentHistory: [
          { amount: 2000, date: new Date('2024-02-01'), paymentDate: new Date('2024-02-01') },
          { amount: 2000, date: new Date('2024-03-01'), paymentDate: new Date('2024-03-01') },
          { amount: 2000, date: new Date('2024-04-01'), paymentDate: new Date('2024-04-01') },
          { amount: 2000, date: new Date('2024-05-01'), paymentDate: new Date('2024-05-01') },
          { amount: 2000, date: new Date('2024-06-01'), paymentDate: new Date('2024-06-01') },
          { amount: 2000, date: new Date('2024-07-01'), paymentDate: new Date('2024-07-01') },
          { amount: 2000, date: new Date('2024-08-01'), paymentDate: new Date('2024-08-01') },
          { amount: 2000, date: new Date('2024-09-01'), paymentDate: new Date('2024-09-01') },
          { amount: 2000, date: new Date('2024-10-01'), paymentDate: new Date('2024-10-01') },
          { amount: 2000, date: new Date('2024-11-01'), paymentDate: new Date('2024-11-01') }
        ]
      }
    },
    expected: {
      generalProfit: 8000,
      sellingPrice: 25000,
      soldPrice: 25000,
      totalPaid: 25000, // 5,000 + 10×2,000 = 25,000
      remainingAmount: 0
    }
  },
  {
    name: "Paid Sale - For Comparison",
    car: {
      licenseNo: "TEST004",
      brand: "BMW",
      model: "3 Series",
      year: 2022,
      purchasePrice: 15000,
      priceToSell: 28000, // Original asking price
      isAvailable: false,
      boughtType: "Paid",
      repairs: [
        { cost: 1000, description: "Oil change" },
        { cost: 1000, description: "New tires" }
      ],
      sale: {
        price: 25000, // Actually sold for less
        date: new Date('2024-01-15')
      }
    },
    expected: {
      generalProfit: 8000, // 25,000 - (15,000 + 2,000) = 8,000
      sellingPrice: 28000, // Original asking price
      soldPrice: 25000, // Actual sale price
      totalPaid: 25000,
      remainingAmount: 0
    }
  }
];

// Test function
async function testProfitCalculations() {
  console.log('🧮 Testing Installment Profit Calculations\n');
  console.log('=' .repeat(80));

  try {
    // Connect to MongoDB (optional if you're already connected)
    // await mongoose.connect(process.env.MONGO_URL);

    for (const testCase of testCases) {
      console.log(`\n📊 Test Case: ${testCase.name}`);
      console.log('-'.repeat(50));

      // Create car document (without saving to database)
      const car = new Car(testCase.car);
      
      // Test general profit
      const generalProfit = car.profit;
      console.log(`General Profit: $${generalProfit?.toLocaleString() || 'NULL'}`);
      console.log(`Expected: $${testCase.expected.generalProfit.toLocaleString()}`);
      
      // Test detailed profit
      const profitDetails = car.profitDetails;
      if (profitDetails) {
        console.log(`Selling Price: $${profitDetails.sellingPrice?.toLocaleString() || 'NULL'}`);
        console.log(`Sold Price: $${profitDetails.soldPrice?.toLocaleString() || 'NULL'}`);
        console.log(`Purchase Price: $${profitDetails.purchasePrice?.toLocaleString() || 'NULL'}`);
        console.log(`Total Repairs: $${profitDetails.totalRepairs?.toLocaleString() || 'NULL'}`);
        
        if (profitDetails.paymentBreakdown) {
          console.log(`Down Payment: $${profitDetails.paymentBreakdown.downPayment?.toLocaleString() || 'NULL'}`);
          console.log(`Total Paid: $${profitDetails.paymentBreakdown.totalPaid?.toLocaleString() || 'NULL'}`);
          console.log(`Remaining Amount: $${profitDetails.paymentBreakdown.remainingAmount?.toLocaleString() || 'NULL'}`);
          console.log(`Monthly Payments: ${profitDetails.paymentBreakdown.monthlyPayments?.length || 0} payments`);
        }
      }

      // Verify results
      const profitMatch = generalProfit === testCase.expected.generalProfit;
      const sellingPriceMatch = profitDetails?.sellingPrice === testCase.expected.sellingPrice;
      const soldPriceMatch = profitDetails?.soldPrice === testCase.expected.soldPrice;
      const totalPaidMatch = profitDetails?.paymentBreakdown?.totalPaid === testCase.expected.totalPaid;
      const remainingMatch = profitDetails?.paymentBreakdown?.remainingAmount === testCase.expected.remainingAmount;

      console.log('\n✅ Verification Results:');
      console.log(`General Profit Match: ${profitMatch ? '✅' : '❌'}`);
      console.log(`Selling Price Match: ${sellingPriceMatch ? '✅' : '❌'}`);
      console.log(`Sold Price Match: ${soldPriceMatch ? '✅' : '❌'}`);
      console.log(`Total Paid Match: ${totalPaidMatch ? '✅' : '❌'}`);
      console.log(`Remaining Amount Match: ${remainingMatch ? '✅' : '❌'}`);

      const allTestsPass = profitMatch && sellingPriceMatch && soldPriceMatch && totalPaidMatch && remainingMatch;
      console.log(`\n🎯 Overall Result: ${allTestsPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🏁 Testing Complete!');

  } catch (error) {
    console.error('❌ Test Error:', error);
  } finally {
    // await mongoose.disconnect();
  }
}

// Manual calculation function for verification
function manualProfitCalculation(carData) {
  const purchasePrice = carData.purchasePrice;
  const totalRepairs = carData.repairs.reduce((sum, r) => sum + r.cost, 0);
  
  if (carData.boughtType === "Installment") {
    const downPayment = carData.installment.downPayment || 0;
    const paymentHistoryTotal = (carData.installment.paymentHistory || [])
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPaid = downPayment + paymentHistoryTotal;
    const remainingAmount = carData.installment.remainingAmount || 0;
    const totalContractValue = totalPaid + remainingAmount;
    
    return {
      totalContractValue,
      totalPaid,
      remainingAmount,
      profit: totalContractValue - (purchasePrice + totalRepairs)
    };
  } else if (carData.boughtType === "Paid") {
    return {
      sellingPrice: carData.priceToSell,
      soldPrice: carData.sale.price,
      profit: carData.sale.price - (purchasePrice + totalRepairs)
    };
  }
}

// Run tests
if (require.main === module) {
  testProfitCalculations();
}

module.exports = { testProfitCalculations, testCases, manualProfitCalculation };
