// test/setup.js
const path = require('path')

// Set test timeout for integration tests
jest.setTimeout(10000)

// Load environment variables for integration tests
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env') })
}

// Global test setup
global.testConfig = {
  // VRM API base URL
  VRM_API_BASE: 'https://vrmapi.victronenergy.com/v2',

  // Test environment flags
  isIntegrationTest: process.env.NODE_ENV === 'integration',

  // Helper to check if integration tests should run
  hasIntegrationCredentials: () => {
    return !!(
      process.env.VRM_API_TOKEN &&
      process.env.VRM_TEST_SITE_ID &&
      process.env.VRM_TEST_USER_ID
    )
  }
}

// Console helper for debug mode
if (process.env.DEBUG) {
  console.log('Debug mode enabled')
  console.log('Integration credentials available:', global.testConfig.hasIntegrationCredentials())
}
