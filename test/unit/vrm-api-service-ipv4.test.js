// test/unit/vrm-api-service-ipv4.test.js
const VRMAPIService = require('../../src/services/vrm-api-service')

jest.mock('dns')
const dns = require('dns')

describe('VRMAPIService IPv4 Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Constructor with forceIpv4 option', () => {
    it('should not configure DNS when forceIpv4 is false', () => {
      const service = new VRMAPIService('test_token', { forceIpv4: false })

      expect(service.forceIpv4).toBe(false)
      expect(dns.setDefaultResultOrder).not.toHaveBeenCalled()
    })

    it('should not configure DNS when forceIpv4 is not specified', () => {
      const service = new VRMAPIService('test_token')

      expect(service.forceIpv4).toBe(false)
      expect(dns.setDefaultResultOrder).not.toHaveBeenCalled()
    })

    it('should set DNS to prefer IPv4 when forceIpv4 is true', () => {
      const service = new VRMAPIService('test_token', { forceIpv4: true })

      expect(service.forceIpv4).toBe(true)
      expect(dns.setDefaultResultOrder).toHaveBeenCalledWith('ipv4first')
    })
  })

  describe('API calls with forceIpv4 enabled', () => {
    it('should make requests when forceIpv4 is configured', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true, user: { id: 123 } })
      })

      const service = new VRMAPIService('test_token', { forceIpv4: true })

      await service.callUsersAPI('me')

      expect(global.fetch).toHaveBeenCalled()
      expect(dns.setDefaultResultOrder).toHaveBeenCalledWith('ipv4first')
    })

    it('should work normally without DNS override when forceIpv4 is false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true, user: { id: 123 } })
      })

      const service = new VRMAPIService('test_token', { forceIpv4: false })

      await service.callUsersAPI('me')

      expect(global.fetch).toHaveBeenCalled()
      expect(dns.setDefaultResultOrder).not.toHaveBeenCalled()
    })
  })

  describe('Multiple service instances with different IPv4 settings', () => {
    it('should handle multiple services with different IPv4 configurations', () => {
      const service1 = new VRMAPIService('token1', { forceIpv4: false })
      expect(dns.setDefaultResultOrder).not.toHaveBeenCalled()

      const service2 = new VRMAPIService('token2', { forceIpv4: true })
      expect(dns.setDefaultResultOrder).toHaveBeenCalledWith('ipv4first')

      expect(service1.forceIpv4).toBe(false)
      expect(service2.forceIpv4).toBe(true)
    })
  })
})
