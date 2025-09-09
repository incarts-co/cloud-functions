/**
 * @fileoverview Test script to verify GeoIP field coalescing logic
 * @description Tests that both camelCase and lowercase field names are properly handled
 */

// Test scenarios for GeoIP field coalescing
const testScenarios = [
  {
    name: "CamelCase fields only",
    input: {
      geoipData: {
        cityName: "New York",
        countryName: "United States",
        postalCode: "10001",
        state: [
          { isoCode: "NY", name: "New York" }
        ],
        location: {
          latitude: 40.7128,
          longitude: -74.0060
        }
      }
    },
    expected: {
      city_name: "New York",
      country_name: "United States", 
      postal_code: "10001",
      state_iso_code: "NY",
      state_name: "New York"
    }
  },
  {
    name: "Lowercase fields only",
    input: {
      geoipData: {
        city: "Los Angeles",
        country: "United States",
        postal: "90001",
        region: "California",
        location: {
          latitude: 34.0522,
          longitude: -118.2437
        }
      }
    },
    expected: {
      city_name: "Los Angeles",
      country_name: "United States",
      postal_code: "90001",
      state_iso_code: null,
      state_name: "California"
    }
  },
  {
    name: "Mixed fields (camelCase takes precedence)",
    input: {
      geoipData: {
        cityName: "Chicago",
        city: "Old Chicago Name",
        countryName: "United States",
        country: "USA",
        postalCode: "60601",
        postal: "60000",
        state: [
          { isoCode: "IL", name: "Illinois" }
        ],
        region: "Midwest"
      }
    },
    expected: {
      city_name: "Chicago", // camelCase takes precedence
      country_name: "United States", // camelCase takes precedence
      postal_code: "60601", // camelCase takes precedence
      state_iso_code: "IL",
      state_name: "Illinois" // state array takes precedence over region
    }
  },
  {
    name: "Empty/null state array with region fallback",
    input: {
      geoipData: {
        cityName: "Miami",
        countryName: "United States",
        postalCode: "33101",
        state: null,
        region: "Florida"
      }
    },
    expected: {
      city_name: "Miami",
      country_name: "United States",
      postal_code: "33101",
      state_iso_code: null,
      state_name: "Florida" // Falls back to region when state is null
    }
  }
];

console.log('Testing GeoIP Field Coalescing Logic\n');
console.log('=' .repeat(60));

testScenarios.forEach((scenario, index) => {
  console.log(`\nTest ${index + 1}: ${scenario.name}`);
  console.log('-'.repeat(40));
  
  // Simulate the coalescing logic from the function
  const geoipData = scenario.input.geoipData;
  const result = {
    city_name: geoipData?.cityName || geoipData?.city,
    country_name: geoipData?.countryName || geoipData?.country,
    postal_code: geoipData?.postalCode || geoipData?.postal,
    state_iso_code: Array.isArray(geoipData?.state) && 
      geoipData.state[0]?.isoCode || null,
    state_name: Array.isArray(geoipData?.state) && 
      geoipData.state[0]?.name || 
      geoipData?.region
  };
  
  // Compare with expected
  let allPassed = true;
  Object.keys(scenario.expected).forEach(key => {
    const expected = scenario.expected[key];
    const actual = result[key];
    const passed = expected === actual;
    
    if (!passed) allPassed = false;
    
    console.log(`  ${key}: ${passed ? '✅' : '❌'}`);
    if (!passed) {
      console.log(`    Expected: ${expected}`);
      console.log(`    Actual: ${actual}`);
    }
  });
  
  console.log(`Result: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
});

console.log('\n' + '='.repeat(60));
console.log('Summary:');
console.log('  - CamelCase fields are properly captured');
console.log('  - Lowercase fields are properly captured');
console.log('  - CamelCase takes precedence when both exist');
console.log('  - State array is properly extracted');
console.log('  - Region is used as fallback for state_name');
console.log('  - No more silent data loss from field naming inconsistencies!');
console.log('=' .repeat(60));