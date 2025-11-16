// test/unit/vrm-api-service-ipv4.test.js
const VRMAPIService = require('../../src/services/vrm-api-service')
const http = require('http')
const https = require('https')

// Mock axios to avoid actual HTTP calls
jest.mock('axios')
const axios = require('axios')

describe('VRMAPIService IPv4 Agent Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Constructor with forceIpv4 option', () => {
    it('should not configure agents when forceIpv4 is false', () => {
      const service = new VRMAPIService('test_token', {
        forceIpv4: false
      })

      expect(service.forceIpv4).toBe(false)
      expect(axios.defaults.httpAgent).toBeUndefined()
      expect(axios.defaults.httpsAgent).toBeUndefined()
    })

    it('should not configure agents when forceIpv4 is not specified', () => {
      const service = new VRMAPIService('test_token')

      expect(service.forceIpv4).toBe(false)
      expect(axios.defaults.httpAgent).toBeUndefined()
      expect(axios.defaults.httpsAgent).toBeUndefined()
    })

    it('should configure HTTP and HTTPS agents with family 4 when forceIpv4 is true', () => {
      const service = new VRMAPIService('test_token', {
        forceIpv4: true
      })

      expect(service.forceIpv4).toBe(true)

      // Verify axios defaults were set
      expect(axios.defaults.httpAgent).toBeInstanceOf(http.Agent)
      expect(axios.defaults.httpsAgent).toBeInstanceOf(https.Agent)
    })
  })

  describe('API calls with IPv4 agents', () => {
    it('should make requests with IPv4 agent when configured', async () => {
      // Mock axios.get response
      axios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: { success: true, user: { id: 123 } }
      })

      // Create service with IPv4 forced
      const service = new VRMAPIService('test_token', {
        forceIpv4: true
      })

      // Make a request
      await service.callUsersAPI('me')

      // Verify the request was made
      expect(axios.get).toHaveBeenCalled()

      // Verify that axios defaults have agents configured
      expect(axios.defaults.httpAgent).toBeDefined()
      expect(axios.defaults.httpsAgent).toBeDefined()
    })

    it('should work normally without agents when forceIpv4 is false', async () => {
      // Clear any previous agent configuration
      delete axios.defaults.httpAgent
      delete axios.defaults.httpsAgent

      // Mock axios.get response
      axios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: { success: true, user: { id: 123 } }
      })

      // Create service without forcing IPv4
      const service = new VRMAPIService('test_token', {
        forceIpv4: false
      })

      // Make a request
      await service.callUsersAPI('me')

      // Verify the request was made
      expect(axios.get).toHaveBeenCalled()

      // Verify that axios defaults do not have agents
      expect(axios.defaults.httpAgent).toBeUndefined()
      expect(axios.defaults.httpsAgent).toBeUndefined()
    })
  })

  describe('Multiple service instances with different IPv4 settings', () => {
    it('should handle multiple services with different IPv4 configurations', () => {
      // Note: axios.defaults is global, so the last configuration wins
      // This test documents this behavior

      const service1 = new VRMAPIService('token1', { forceIpv4: false })
      expect(axios.defaults.httpAgent).toBeUndefined()

      const service2 = new VRMAPIService('token2', { forceIpv4: true })
      expect(axios.defaults.httpAgent).toBeInstanceOf(http.Agent)
      expect(axios.defaults.httpsAgent).toBeInstanceOf(https.Agent)

      // Verify both services maintain their individual settings
      expect(service1.forceIpv4).toBe(false)
      expect(service2.forceIpv4).toBe(true)
    })
  })
})
