const VRMAPIService = require('../../src/services/vrm-api-service')

jest.mock('axios')
const axios = require('axios')

describe('VRMAPIService - makeCustomCall', () => {
  let service

  beforeEach(() => {
    service = new VRMAPIService('test_token')
    jest.clearAllMocks()
  })

  it('should make successful GET request', async () => {
    const mockResponse = {
      status: 200,
      data: { success: true, records: [] }
    }

    axios.get = jest.fn().mockResolvedValue(mockResponse)

    const result = await service.makeCustomCall(
      'https://vrmapi.victronenergy.com/v2/installations/12345/settings',
      'GET'
    )

    expect(result.success).toBe(true)
    expect(result.status).toBe(200)
    expect(result.method).toBe('get')
  })

  it('should make successful POST request with payload', async () => {
    const payload = { geofenceEnabled: 0 }
    const mockResponse = {
      status: 200,
      data: { success: true }
    }

    axios.post = jest.fn().mockResolvedValue(mockResponse)

    const result = await service.makeCustomCall(
      'https://vrmapi.victronenergy.com/v2/installations/12345/settings',
      'POST',
      payload
    )

    expect(axios.post).toHaveBeenCalledWith(
      'https://vrmapi.victronenergy.com/v2/installations/12345/settings',
      payload,
      expect.any(Object)
    )
    expect(result.success).toBe(true)
    expect(result.method).toBe('post')
  })

  it('should handle errors gracefully', async () => {
    const mockError = {
      response: {
        status: 404,
        data: { error: 'Not found' }
      },
      message: 'Request failed'
    }

    axios.get = jest.fn().mockRejectedValue(mockError)

    const result = await service.makeCustomCall('https://example.com', 'GET')

    expect(result.success).toBe(false)
    expect(result.status).toBe(404)
    expect(result.error).toBe('Request failed')
  })

  it('should support PATCH, PUT, and DELETE methods', async () => {
    axios.patch = jest.fn().mockResolvedValue({ status: 200, data: {} })
    axios.put = jest.fn().mockResolvedValue({ status: 200, data: {} })
    axios.delete = jest.fn().mockResolvedValue({ status: 204, data: {} })

    await service.makeCustomCall('https://example.com', 'PATCH', {})
    await service.makeCustomCall('https://example.com', 'PUT', {})
    await service.makeCustomCall('https://example.com', 'DELETE')

    expect(axios.patch).toHaveBeenCalled()
    expect(axios.put).toHaveBeenCalled()
    expect(axios.delete).toHaveBeenCalled()
  })
})
