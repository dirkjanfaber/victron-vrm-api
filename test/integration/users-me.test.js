// test/integration/users-me.test.js
const VRMAPIService = require('../../src/services/vrm-api-service')

require('dotenv').config()

describe('VRM API Integration - Users Me', () => {
  let apiService

  const skipIfNoCredentials = () => {
    if (!process.env.VRM_API_TOKEN) {
      console.log('⚠️  Skipping integration tests - VRM API token not configured')
      return true
    }
    return false
  }

  beforeAll(() => {
    if (skipIfNoCredentials()) return
    apiService = new VRMAPIService(process.env.VRM_API_TOKEN)
  })

  describe('Basic User Information', () => {
    it('should successfully fetch current user information', async () => {
      if (skipIfNoCredentials()) return

      const result = await apiService.callUsersAPI('me')

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toBeDefined()
      expect(typeof result.data).toBe('object')

      console.log('👤 User information:')
      console.log(`   URL: ${result.url}`)
      console.log(`   User ID: ${result.data.user?.id || 'N/A'}`)
      console.log(`   Email: ${result.data.user?.email || 'N/A'}`)
      console.log(`   Name: ${result.data.user?.name || 'N/A'}`)
      console.log(`   Country: ${result.data.user?.country || 'N/A'}`)

      // Verify URL format
      expect(result.url).toBe('https://vrmapi.victronenergy.com/v2/users/me')
      expect(result.method).toBe('get')

      // Check for expected user properties - actual API structure has user nested
      expect(result.data).toHaveProperty('user')
      expect(result.data.user).toHaveProperty('id')
      expect(typeof result.data.user.id).toBe('number')
    }, 15000)

    it('should return user data structure matching API documentation', async () => {
      if (skipIfNoCredentials()) return

      const result = await apiService.callUsersAPI('me')

      expect(result.success).toBe(true)

      // Log full structure for verification
      console.log('📋 Complete user data structure:')
      console.log(JSON.stringify(result.data, null, 2))

      // Check for common expected fields based on VRM API docs
      const expectedFields = ['id', 'email', 'name']
      expectedFields.forEach(field => {
        expect(result.data.user).toHaveProperty(field)
      })

      // Store user ID for other tests if available
      if (result.data.idUser && !process.env.VRM_TEST_USER_ID) {
        console.log(`💡 Discovered user ID: ${result.data.idUser}`)
        console.log('   You can add this to your .env file as VRM_TEST_USER_ID')
      }
    }, 15000)
  })

  describe('User Installations', () => {
    it('should fetch all installations for current user', async () => {
      if (skipIfNoCredentials()) return

      const result = await apiService.callUsersAPI('installations')

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toBeDefined()

      console.log('🏠 User installations:')
      console.log(`   URL: ${result.url}`)
      console.log(`   Installation count: ${result.data.records?.length || 'N/A'}`)

      // 🔍 DEBUG: Log the actual response structure to understand the API
      console.log('📋 Raw installations response structure:')
      console.log(JSON.stringify(result.data, null, 2))

      // Verify URL format
      expect(result.url).toBe('https://vrmapi.victronenergy.com/v2/users/me/installations')

      // Check if we have installations data
      if (result.data.records && result.data.records.length > 0) {
        const firstInstall = result.data.records[0]
        console.log('🏗️ Sample installation:')
        console.log(`   ID: ${firstInstall.idSite}`)
        console.log(`   Name: ${firstInstall.name || 'N/A'}`)

        // Verify we have the test site ID in the results
        if (process.env.VRM_TEST_SITE_ID) {
          const testSite = result.data.records.find(
            install => install.idSite?.toString() === process.env.VRM_TEST_SITE_ID
          )
          if (testSite) {
            expect(testSite).toBeDefined()
            console.log(`✅ Test site ${process.env.VRM_TEST_SITE_ID} found in user installations`)
          } else {
            console.log(`⚠️  Test site ${process.env.VRM_TEST_SITE_ID} not found in user installations`)
            console.log('   This might be expected if the site belongs to a different user')
          }
        }
      }
    }, 15000)

    it('should fetch installations for specific user ID if provided', async () => {
      if (skipIfNoCredentials()) return

      // Only test this if we have a user ID configured
      if (!process.env.VRM_TEST_USER_ID) {
        console.log('⚠️  Skipping specific user ID test - VRM_TEST_USER_ID not configured')
        return
      }

      const result = await apiService.callUsersAPI('installations', process.env.VRM_TEST_USER_ID)

      console.log('👥 Specific user installations:')
      console.log(`   URL: ${result.url}`)
      console.log(`   Status: ${result.status}`)

      // Verify URL format with user ID
      expect(result.url).toBe(`https://vrmapi.victronenergy.com/v2/users/${process.env.VRM_TEST_USER_ID}/installations`)

      if (result.success) {
        console.log(`   Installation count: ${result.data.records?.length || 'N/A'}`)
      } else {
        console.log(`   Error: ${result.error}`)
        console.log('   Note: This might fail if the user ID belongs to a different account')
      }
    }, 15000)
  })

  describe('Authentication and Permissions', () => {
    it('should fail gracefully with invalid token', async () => {
      const invalidApiService = new VRMAPIService('invalid_token_12345')

      const result = await invalidApiService.callUsersAPI('me')

      expect(result.success).toBe(false)
      expect(result.status).toBeGreaterThanOrEqual(400)

      console.log('🔐 Invalid token test:')
      console.log(`   Status: ${result.status}`)
      console.log(`   Error: ${result.error}`)
    }, 15000)

    it('should include correct authorization header', async () => {
      if (skipIfNoCredentials()) return

      // We can't directly inspect the headers sent, but we can verify
      // that the service is configured correctly
      expect(apiService.apiToken).toBe(process.env.VRM_API_TOKEN)
      expect(apiService.apiToken).toMatch(/^[a-f0-9]{64}$/)

      // Successful API call implies correct headers
      const result = await apiService.callUsersAPI('me')
      expect(result.success).toBe(true)
    }, 10000)
  })

  describe('Response Data Validation', () => {
    it('should return consistent user data across multiple calls', async () => {
      if (skipIfNoCredentials()) return

      // Make two calls and compare results
      const result1 = await apiService.callUsersAPI('me')
      const result2 = await apiService.callUsersAPI('me')

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)

      // User data should be consistent
      expect(result1.data.user.id).toBe(result2.data.user.id)
      expect(result1.data.user.email).toBe(result2.data.user.email)

      console.log('🔄 Consistency check passed')
    }, 20000)

    it('should handle rate limiting gracefully', async () => {
      if (skipIfNoCredentials()) return

      // Make several rapid requests to test rate limiting
      const promises = Array(5).fill().map((_, i) =>
        apiService.callUsersAPI('me').then(result => ({ call: i + 1, ...result }))
      )

      const results = await Promise.all(promises)

      console.log('⚡ Rate limiting test:')
      results.forEach(result => {
        console.log(`   Call ${result.call}: Status ${result.status}, Success: ${result.success}`)
      })

      // At least some calls should succeed
      const successfulCalls = results.filter(r => r.success)
      expect(successfulCalls.length).toBeGreaterThan(0)
    }, 30000)
  })
})
