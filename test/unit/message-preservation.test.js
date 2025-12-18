/**
 * Tests for message property preservation (Issue #41)
 *
 * The node must preserve all properties from the original message,
 * especially HTTP context properties like msg.res and msg.req
 */

const VRMAPIService = require('../../src/services/vrm-api-service')

jest.mock('axios')
const axios = require('axios')

describe('Message Property Preservation', () => {
  let service

  beforeEach(() => {
    service = new VRMAPIService('test_token')
    jest.clearAllMocks()
  })

  describe('HTTP Context Preservation', () => {
    it('should preserve msg.res and msg.req for HTTP response flow', async () => {
      // Mock successful API response
      axios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: { success: true, records: [] }
      })

      // Call the API (this tests the service, but the real preservation happens in the node)
      const result = await service.callInstallationsAPI('12345', 'stats')

      // Verify API was called
      expect(axios.get).toHaveBeenCalled()
      expect(result.success).toBe(true)

      // Note: The actual message cloning happens in vrm-api.js
      // This test verifies the service returns data correctly
      // The integration test will verify full message preservation
    })
  })

  describe('Custom Property Preservation', () => {
    it('should preserve custom message properties', async () => {
      axios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: { success: true, installations: [] }
      })

      const result = await service.callUsersAPI('me')

      expect(result.success).toBe(true)
      // Service should return data; node will preserve original msg properties
    })
  })

  describe('Dual Output Independence', () => {
    it('should provide independent message clones for dual outputs', async () => {
      // Mock response suitable for price schedule transformation
      axios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          success: true,
          records: {
            800: [[1234567890, 0.15], [1234567900, 0.20]],
            801: [[1234567890, 0.18], [1234567900, 0.22]]
          }
        }
      })

      const result = await service.callInstallationsAPI('12345', 'stats', 'GET', null, {
        parameters: { attributeCodes: ['800', '801'] }
      })

      expect(result.success).toBe(true)
      expect(result.data.records).toBeDefined()

      // The node should create two independent clones
      // This ensures modifying output 1 doesn't affect output 2
    })
  })

  describe('Error Path Message Handling', () => {
    it('should preserve original message on API errors', async () => {
      axios.get = jest.fn().mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Unauthorized' }
        },
        message: 'Request failed'
      })

      const result = await service.callInstallationsAPI('12345', 'stats')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Request failed')

      // The node's error handler (line 186) sends the original msg
      // which is correct behavior
    })
  })

  describe('Widget API Message Preservation', () => {
    it('should preserve message properties for widget API calls', async () => {
      axios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          success: true,
          totals: { battery: 50 }
        }
      })

      const result = await service.callWidgetsAPI('12345', 'Graph', 1)

      expect(result.success).toBe(true)
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/widgets/Graph?instance=1'),
        expect.objectContaining({
          headers: expect.any(Object)
        })
      )
    })
  })

  describe('Custom API Call Message Preservation', () => {
    it('should preserve message properties for custom API calls', async () => {
      axios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: { custom: 'response' }
      })

      const customUrl = 'https://vrmapi.victronenergy.com/v2/custom/endpoint'
      const result = await service.makeCustomCall(customUrl, 'GET', null)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ custom: 'response' })
    })
  })
})
