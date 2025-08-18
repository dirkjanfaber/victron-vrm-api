// test/integration/installations-dynamic-ess-settings.test.js
const VRMAPIService = require('../../src/services/vrm-api-service')

// Load environment variables
require('dotenv').config()

xdescribe('VRM API Integration - Dynamic ESS Settings PATCH Bug Detection', () => {
  let apiService

  // Skip integration tests if credentials are not available
  const skipIfNoCredentials = () => {
    if (!process.env.VRM_API_TOKEN || !process.env.VRM_TEST_SITE_ID) {
      console.log('⚠️  Skipping integration tests - VRM API credentials not configured')
      console.log('   Create a .env file with VRM_API_TOKEN and VRM_TEST_SITE_ID')
      return true
    }
    return false
  }

  beforeAll(() => {
    if (skipIfNoCredentials()) return

    apiService = new VRMAPIService(process.env.VRM_API_TOKEN)
  })

  describe('Environment Setup', () => {
    it('should have required environment variables', () => {
      if (skipIfNoCredentials()) return

      expect(process.env.VRM_API_TOKEN).toBeDefined()
      expect(process.env.VRM_API_TOKEN).toMatch(/^[a-f0-9]{64}$/) // 64 char hex string

      expect(process.env.VRM_TEST_SITE_ID).toBeDefined()
      expect(process.env.VRM_TEST_SITE_ID).toMatch(/^\d+$/) // Numeric
    })
  })

  describe('Dynamic ESS Settings - Basic Operations', () => {
    const siteId = process.env.VRM_TEST_SITE_ID

    it('should format status display correctly for different modes', async () => {
      if (skipIfNoCredentials()) return

      const result = await apiService.callInstallationsAPI(siteId, 'dynamic-ess-settings', 'GET')

      expect(result.success).toBe(true)

      if (result.data && result.data.data) {
        // Test the service's status interpretation method
        const statusInfo = apiService.interpretDynamicEssStatus(result.data)

        console.log('🎨 Status Display Test (using service method):')
        console.log(`   Current mode: ${statusInfo.mode} (${statusInfo.modeName})`)
        console.log(`   Current op mode: ${statusInfo.operatingMode} (${statusInfo.operatingModeName})`)
        console.log(`   Status text: "${statusInfo.text}"`)
        console.log(`   Status color: ${statusInfo.color}`)

        // Verify the status interpretation
        expect(statusInfo.text).toMatch(/^(Off|Auto|Buy \(deprecated\)|Sell \(deprecated\)|Local|Unknown) - (Trade|Green|Unknown) mode$/)
        expect(['blue', 'green']).toContain(statusInfo.color)
        expect(typeof statusInfo.mode).toBe('number')
        expect(typeof statusInfo.operatingMode).toBe('number')

        // Test the color logic
        if (statusInfo.mode === 0) {
          expect(statusInfo.color).toBe('blue')
        } else {
          expect(statusInfo.color).toBe('green')
        }

        // Test all possible combinations (for completeness)
        console.log('\n🧪 Testing all possible status combinations:')
        for (let m = 0; m <= 4; m++) {
          for (let op = 0; op <= 1; op++) {
            const testData = { data: { mode: m, operatingMode: op } }
            const testStatus = apiService.interpretDynamicEssStatus(testData)
            console.log(`   Mode ${m}, Op ${op}: "${testStatus.text}" (${testStatus.color})`)

            // Verify each combination
            expect(testStatus.text).toBeDefined()
            expect(['blue', 'green']).toContain(testStatus.color)
            expect(testStatus.mode).toBe(m)
            expect(testStatus.operatingMode).toBe(op)
          }
        }
      } else {
        console.log('⚠️  No detailed mode data available in response')
      }
    }, 15000)

    it('should handle various Dynamic ESS PATCH payloads', async () => {
      if (skipIfNoCredentials()) return

      // Test different payload structures that might work better
      const testPayloads = [
        { isGreenModeOn: false },
        { isGreenModeOn: false },
        { data: { isGreenModeOn: false } },
        // Add async flag as in the curl example
        { isGreenModeOn: false, async: false }
      ]

      for (const [index, payload] of testPayloads.entries()) {
        console.log(`🧪 Testing payload ${index + 1}:`, JSON.stringify(payload))

        const result = await apiService.callInstallationsAPI(
          siteId,
          'patch-dynamic-ess-settings',
          'PATCH',
          payload
        )

        console.log(`   Status: ${result.status}, Success: ${result.success}`)
        if (result.data) {
          console.log(`   Response isGreenModeOn: ${result.data.isGreenModeOn}`)
        }
        if (result.error) {
          console.log(`   Error: ${result.error}`)
        }

        // We don't expect all payloads to work, just logging results
      }
    }, 30000)
  })
})
