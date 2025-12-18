/**
 * Unit tests for VRM API Service - schedule-dynamic-ess endpoint
 */

const VRMAPIService = require('../../src/services/vrm-api-service')
const axios = require('axios')

// Mock axios
jest.mock('axios')

describe('VRMAPIService - schedule-dynamic-ess endpoint', () => {
  let service
  const testToken = 'test-token-12345'
  const testSiteId = '123456'

  beforeEach(() => {
    service = new VRMAPIService(testToken)
    jest.clearAllMocks()
  })

  describe('fetch-dynamic-ess-schedules endpoint', () => {
    it('should use schedule-dynamic-ess endpoint, not stats', async () => {
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          records: []
        }
      }
      axios.get.mockResolvedValue(mockResponse)

      const result = await service.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )

      expect(result.success).toBe(true)
      expect(axios.get).toHaveBeenCalledTimes(1)
      const callUrl = axios.get.mock.calls[0][0]

      // Verify correct endpoint
      expect(callUrl).toContain('/schedule-dynamic-ess')
      expect(callUrl).not.toContain('/stats')

      // Verify async parameter
      expect(callUrl).toContain('async=0')

      // Verify full URL structure
      expect(callUrl).toBe(
        `https://vrmapi.victronenergy.com/v2/installations/${testSiteId}/schedule-dynamic-ess?async=0`
      )
    })

    it('should use GET method', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true }
      }
      axios.get.mockResolvedValue(mockResponse)

      await service.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )

      expect(axios.get).toHaveBeenCalled()
      expect(axios.post).not.toHaveBeenCalled()
      expect(axios.patch).not.toHaveBeenCalled()
    })

    it('should include proper headers', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true }
      }
      axios.get.mockResolvedValue(mockResponse)

      await service.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )

      const callHeaders = axios.get.mock.calls[0][1].headers

      expect(callHeaders['X-Authorization']).toBe(`Token ${testToken}`)
      expect(callHeaders.accept).toBe('application/json')
      expect(callHeaders['User-Agent']).toMatch(/nrc-vrm-api/)
    })

    it('should return success response with correct metadata', async () => {
      const mockData = {
        success: true,
        records: [
          { timestamp: 1234567890, value: 0.25 },
          { timestamp: 1234567900, value: 0.30 }
        ]
      }
      const mockResponse = {
        status: 200,
        data: mockData
      }
      axios.get.mockResolvedValue(mockResponse)

      const result = await service.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toEqual(mockData)
      expect(result.method).toBe('get')
      expect(result.url).toContain('/schedule-dynamic-ess')
    })

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { error: 'Not found' }
        },
        message: 'Request failed with status code 404'
      }
      axios.get.mockRejectedValue(mockError)

      const result = await service.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )

      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
      expect(result.error).toBe('Request failed with status code 404')
      expect(result.data).toEqual({ error: 'Not found' })
    })

    it('should not include stats-related parameters', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true }
      }
      axios.get.mockResolvedValue(mockResponse)

      await service.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )

      const callUrl = axios.get.mock.calls[0][0]

      // These should NOT be in the URL
      expect(callUrl).not.toContain('type=')
      expect(callUrl).not.toContain('interval=')
      expect(callUrl).not.toContain('start=')
      expect(callUrl).not.toContain('end=')
      expect(callUrl).not.toContain('attributeCodes')
    })
  })

  describe('Comparison with other endpoints', () => {
    it('should be different from stats endpoint', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true }
      }
      axios.get.mockResolvedValue(mockResponse)

      // Call the new endpoint
      await service.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )
      const schedulesUrl = axios.get.mock.calls[0][0]

      // Clear and call stats endpoint
      jest.clearAllMocks()
      await service.callInstallationsAPI(
        testSiteId,
        'stats',
        'GET',
        null,
        { parameters: { type: 'dynamic_ess', interval: 'hours' } }
      )
      const statsUrl = axios.get.mock.calls[0][0]

      // They should be different
      expect(schedulesUrl).not.toBe(statsUrl)
      expect(schedulesUrl).toContain('/schedule-dynamic-ess')
      expect(statsUrl).toContain('/stats')
    })

    it('should be different from dynamic-ess-settings endpoint', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true }
      }
      axios.get.mockResolvedValue(mockResponse)

      // Call schedule endpoint
      await service.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )
      const scheduleUrl = axios.get.mock.calls[0][0]

      // Clear and call settings endpoint
      jest.clearAllMocks()
      await service.callInstallationsAPI(
        testSiteId,
        'dynamic-ess-settings',
        'GET'
      )
      const settingsUrl = axios.get.mock.calls[0][0]

      // They should be different
      expect(scheduleUrl).toContain('/schedule-dynamic-ess')
      expect(settingsUrl).toContain('/dynamic-ess-settings')
      expect(scheduleUrl).not.toBe(settingsUrl)
    })
  })

  describe('Edge cases', () => {
    it('should handle network timeout', async () => {
      const mockError = {
        message: 'timeout of 5000ms exceeded',
        code: 'ECONNABORTED'
      }
      axios.get.mockRejectedValue(mockError)

      const result = await service.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('timeout of 5000ms exceeded')
    })

    it('should handle invalid site ID format', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true }
      }
      axios.get.mockResolvedValue(mockResponse)

      const invalidSiteId = 'invalid-site-id'
      await service.callInstallationsAPI(
        invalidSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )

      const callUrl = axios.get.mock.calls[0][0]
      expect(callUrl).toContain(`/installations/${invalidSiteId}/schedule-dynamic-ess`)
    })

    it('should use correct base URL', async () => {
      const customBaseUrl = 'https://custom-api.example.com/v2'
      const customService = new VRMAPIService(testToken, { baseUrl: customBaseUrl })

      const mockResponse = {
        status: 200,
        data: { success: true }
      }
      axios.get.mockResolvedValue(mockResponse)

      await customService.callInstallationsAPI(
        testSiteId,
        'fetch-dynamic-ess-schedules',
        'GET'
      )

      const callUrl = axios.get.mock.calls[0][0]
      expect(callUrl).toContain(customBaseUrl)
      expect(callUrl).toBe(
        `${customBaseUrl}/installations/${testSiteId}/schedule-dynamic-ess?async=0`
      )
    })
  })
})
