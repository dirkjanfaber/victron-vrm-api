// test/unit/vrm-api-service.test.js
const VRMAPIService = require('../../src/services/vrm-api-service')

// Mock axios to avoid actual HTTP calls in unit tests
jest.mock('axios')
const axios = require('axios')

describe('VRMAPIService Unit Tests', () => {
  let service

  beforeEach(() => {
    service = new VRMAPIService('test_token_64_characters_long_abcdef0123456789abcdef012345')
    jest.clearAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with correct defaults', () => {
      expect(service.apiToken).toBe('test_token_64_characters_long_abcdef0123456789abcdef012345')
      expect(service.baseUrl).toBe('https://vrmapi.victronenergy.com/v2')
      expect(service.dynamicEssUrl).toBe('https://vrm-dynamic-ess-api.victronenergy.com')
    })

    it('should accept custom options', () => {
      const customService = new VRMAPIService('token', {
        baseUrl: 'https://custom-api.example.com',
        dynamicEssUrl: 'https://custom-dess.example.com',
        userAgent: 'custom-agent/1.0'
      })

      expect(customService.baseUrl).toBe('https://custom-api.example.com')
      expect(customService.dynamicEssUrl).toBe('https://custom-dess.example.com')
      expect(customService.userAgent).toBe('custom-agent/1.0')
    })
  })

  describe('Header Building', () => {
    it('should build correct headers', () => {
      const headers = service._buildHeaders()

      expect(headers).toEqual({
        'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
        accept: 'application/json',
        'User-Agent': expect.stringMatching(/nrc-vrm-api\/\d+\.\d+\.\d+/)
      })
    })

    it('should merge additional headers', () => {
      const headers = service._buildHeaders({
        'Custom-Header': 'custom-value',
        'User-Agent': 'override-agent'
      })

      expect(headers).toEqual({
        'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
        accept: 'application/json',
        'User-Agent': 'override-agent',
        'Custom-Header': 'custom-value'
      })
    })
  })

  describe('User Data Extraction', () => {
    it('should extract user data correctly from VRM API response', () => {
      const apiResponse = {
        success: true,
        user: {
          id: 322456,
          name: 'Dirk-Jan',
          email: 'dfaber@gmail.com',
          country: 'Netherlands',
          idAccessToken: 1234,
          accessLevel: 1
        }
      }

      const extracted = service.extractUserData(apiResponse)

      expect(extracted.id).toBe(322456)
      expect(extracted.email).toBe('dfaber@gmail.com')
      expect(extracted.name).toBe('Dirk-Jan')
      expect(extracted.country).toBe('Netherlands')
      expect(extracted.accessLevel).toBe(1)
      expect(extracted.idAccessToken).toBe(1234)
      expect(extracted.raw).toBe(apiResponse)
    })

    it('should handle missing user data gracefully', () => {
      const testCases = [
        null,
        undefined,
        {},
        { success: true },
        { user: null }
      ]

      testCases.forEach(apiResponse => {
        const extracted = service.extractUserData(apiResponse)
        expect(extracted).toBeNull()
      })
    })
  })

  describe('Users Status Interpretation', () => {
    it('should interpret users/me response correctly', () => {
      const responseData = {
        success: true,
        user: {
          id: 354816,
          name: 'Dirk-Jan RO',
          email: 'd.faber+ro@gmail.com',
          country: 'Netherlands',
          idAccessToken: 787676,
          accessLevel: 1
        }
      }

      const result = service.interpretUsersStatus(responseData, 'me')

      expect(result.text).toBe('Dirk-Jan RO (ID: 354816)')
      expect(result.color).toBe('green')
      expect(result.userId).toBe(354816)
      expect(result.userName).toBe('Dirk-Jan RO')
      expect(result.userEmail).toBe('d.faber+ro@gmail.com')
      expect(result.userCountry).toBe('Netherlands')
      expect(result.accessLevel).toBe(1)
      expect(result.raw).toBe(responseData)
    })

    it('should interpret users/installations response correctly', () => {
      const responseData = {
        success: true,
        records: [
          { idSite: 123, name: 'Installation 1' },
          { idSite: 456, name: 'Installation 2' },
          { idSite: 789, name: 'Installation 3' }
        ]
      }

      const result = service.interpretUsersStatus(responseData, 'installations')

      expect(result.text).toBe('3 installations')
      expect(result.color).toBe('green')
      expect(result.installationCount).toBe(3)
      expect(result.raw).toBe(responseData)
    })

    it('should handle single installation correctly', () => {
      const responseData = {
        success: true,
        records: [
          { idSite: 123, name: 'Installation 1' }
        ]
      }

      const result = service.interpretUsersStatus(responseData, 'installations')

      expect(result.text).toBe('1 installation')
      expect(result.installationCount).toBe(1)
    })

    it('should handle empty installations list', () => {
      const responseData = {
        success: true,
        records: []
      }

      const result = service.interpretUsersStatus(responseData, 'installations')

      expect(result.text).toBe('0 installations')
      expect(result.installationCount).toBe(0)
    })

    it('should handle missing user data gracefully', () => {
      const testCases = [
        null,
        undefined,
        {},
        { success: true },
        { user: null }
      ]

      testCases.forEach(responseData => {
        const result = service.interpretUsersStatus(responseData, 'me')
        expect(result.text).toBe('No user data found')
        expect(result.color).toBe('yellow')
        expect(result.raw).toBe(responseData)
      })
    })

    it('should provide default status for unknown endpoints', () => {
      const responseData = { success: true, someData: 'value' }
      const result = service.interpretUsersStatus(responseData, 'unknown-endpoint')

      expect(result.text).toBe('Users data received')
      expect(result.color).toBe('green')
      expect(result.raw).toBe(responseData)
    })
  })

  describe('Dynamic ESS Status Interpretation', () => {
    it('should interpret all valid mode combinations correctly', () => {
      const testCases = [
        { mode: 0, operatingMode: 0, expectedText: 'Off - Trade mode', expectedColor: 'blue' },
        { mode: 0, operatingMode: 1, expectedText: 'Off - Green mode', expectedColor: 'blue' },
        { mode: 1, operatingMode: 0, expectedText: 'Auto - Trade mode', expectedColor: 'green' },
        { mode: 1, operatingMode: 1, expectedText: 'Auto - Green mode', expectedColor: 'green' },
        { mode: 2, operatingMode: 0, expectedText: 'Buy (deprecated) - Trade mode', expectedColor: 'green' },
        { mode: 3, operatingMode: 1, expectedText: 'Sell (deprecated) - Green mode', expectedColor: 'green' },
        { mode: 4, operatingMode: 0, expectedText: 'Local - Trade mode', expectedColor: 'green' }
      ]

      testCases.forEach(({ mode, operatingMode, expectedText, expectedColor }) => {
        const responseData = { data: { mode, operatingMode } }
        const result = service.interpretDynamicEssStatus(responseData)

        expect(result.text).toBe(expectedText)
        expect(result.color).toBe(expectedColor)
        expect(result.mode).toBe(mode)
        expect(result.operatingMode).toBe(operatingMode)
        expect(result.raw).toBe(responseData)
      })
    })

    it('should handle unknown mode values gracefully', () => {
      const responseData = { data: { mode: 99, operatingMode: 99 } }
      const result = service.interpretDynamicEssStatus(responseData)

      expect(result.text).toBe('Unknown - Unknown mode')
      expect(result.color).toBe('green') // Unknown modes default to green
      expect(result.mode).toBe(99)
      expect(result.operatingMode).toBe(99)
    })

    it('should handle missing data gracefully', () => {
      const testCases = [
        null,
        undefined,
        {},
        { data: null },
        { data: {} },
        { data: { mode: 1 } }, // missing operatingMode
        { data: { operatingMode: 0 } } // missing mode
      ]

      testCases.forEach(responseData => {
        const result = service.interpretDynamicEssStatus(responseData)

        expect(result.text).toBe('No data')
        expect(result.color).toBe('yellow')
        expect(result.mode).toBeNull()
        expect(result.operatingMode).toBeNull()
        expect(result.raw).toBe(responseData)
      })
    })

    it('should provide detailed mode information', () => {
      const responseData = { data: { mode: 1, operatingMode: 1 } }
      const result = service.interpretDynamicEssStatus(responseData)

      expect(result.modeName).toBe('Auto')
      expect(result.operatingModeName).toBe('Green')
    })
  })

  describe('Stats Status Interpretation', () => {
    it('should interpret stats with totals correctly', () => {
      const responseData = {
        totals: {
          consumption: 15.7,
          solar_yield: 23.4
        }
      }

      const result = service.interpretStatsStatus(responseData)

      expect(result.text).toBe('consumption: 15.7')
      expect(result.color).toBe('green')
      expect(result.key).toBe('consumption')
      expect(result.value).toBe(15.7)
      expect(result.formattedValue).toBe('15.7')
      expect(result.totals).toBe(responseData.totals)
    })

    it('should format non-numeric values correctly', () => {
      const responseData = {
        totals: {
          status: 'online'
        }
      }

      const result = service.interpretStatsStatus(responseData)

      expect(result.text).toBe('status: online')
      expect(result.formattedValue).toBe('online')
    })

    it('should replace underscores in key names', () => {
      const responseData = {
        totals: {
          battery_soc: 85.2
        }
      }

      const result = service.interpretStatsStatus(responseData)

      expect(result.text).toBe('battery soc: 85.2')
    })

    it('should handle missing totals gracefully', () => {
      const testCases = [
        null,
        undefined,
        {},
        { totals: null },
        { totals: {} }
      ]

      testCases.forEach(responseData => {
        const result = service.interpretStatsStatus(responseData)

        if (!responseData || !responseData.totals) {
          expect(result.text).toBe('No stats data')
          expect(result.color).toBe('yellow')
          expect(result.totals).toBeNull()
        } else {
          expect(result.text).toBe('No totals')
          expect(result.color).toBe('yellow')
          expect(result.totals).toEqual({})
        }
      })
    })
  })

  describe('API Call Methods', () => {
    beforeEach(() => {
      axios.get = jest.fn()
      axios.post = jest.fn()
      axios.patch = jest.fn()
    })

    it('should call installations API with correct URL', async () => {
      const mockResponse = { status: 200, data: { success: true } }
      axios.get.mockResolvedValue(mockResponse)

      await service.callInstallationsAPI('123456', 'basic', 'GET')

      expect(axios.get).toHaveBeenCalledWith(
        'https://vrmapi.victronenergy.com/v2/installations/123456/basic',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345'
          })
        })
      )
    })

    it('should call users API with correct URL and response structure', async () => {
      const mockResponse = { status: 200, data: { user: { id: 123, email: 'test@example.com' } } }
      axios.get.mockResolvedValue(mockResponse)

      const result = await service.callUsersAPI('me')

      expect(axios.get).toHaveBeenCalledWith(
        'https://vrmapi.victronenergy.com/v2/users/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345'
          })
        })
      )

      // Verify the response structure matches actual VRM API
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('user')
      expect(result.data.user).toHaveProperty('id')
      expect(result.data.user).toHaveProperty('email')
    })

    it('should transform endpoint names correctly', async () => {
      const mockResponse = { status: 200, data: { success: true } }
      axios.post.mockResolvedValue(mockResponse)

      await service.callInstallationsAPI('123456', 'post-alarms', 'GET')

      expect(axios.post).toHaveBeenCalledWith(
        'https://vrmapi.victronenergy.com/v2/installations/123456/alarms',
        null,
        expect.any(Object)
      )
    })

    it('should handle stats parameters correctly', async () => {
      const mockResponse = { status: 200, data: { success: true } }
      axios.get.mockResolvedValue(mockResponse)

      const options = {
        parameters: {
          type: 'custom',
          'attributeCodes[]': ['consumption', 'solar_yield'],
          interval: 'hours'
        }
      }

      await service.callInstallationsAPI('123456', 'stats', 'GET', null, options)

      const expectedUrl = 'https://vrmapi.victronenergy.com/v2/installations/123456/stats?type=custom&attributeCodes%5B%5D=consumption&attributeCodes%5B%5D=solar_yield&interval=hours'
      expect(axios.get).toHaveBeenCalledWith(expectedUrl, expect.any(Object))
    })

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { error: 'Not found' }
        },
        message: 'Request failed'
      }
      axios.get.mockRejectedValue(mockError)

      const result = await service.callInstallationsAPI('999999', 'basic', 'GET')

      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
      expect(result.data).toEqual({ error: 'Not found' })
      expect(result.error).toBe('Request failed')
    })
  })

  it('should pass payload for post-alarms endpoint', async () => {
    const mockResponse = { status: 200, data: { success: true, id: 123 } }
    axios.post.mockResolvedValue(mockResponse)

    const alarmPayload = {
      AlarmEnabled: 1,
      NotifyAfterSeconds: 60,
      highAlarm: 30,
      highAlarmHysteresis: 2,
      idDataAttribute: 450,
      instance: 41,
      lowAlarm: -10,
      lowAlarmHysteresis: 1.5
    }

    const result = await service.callInstallationsAPI('123456', 'post-alarms', 'POST', alarmPayload)

    expect(axios.post).toHaveBeenCalledWith(
      'https://vrmapi.victronenergy.com/v2/installations/123456/alarms',
      alarmPayload,
      expect.any(Object)
    )
    expect(result.success).toBe(true)
    expect(result.method).toBe('post')
  })

  it('should pass payload for patch-dynamic-ess-settings endpoint', async () => {
    const mockResponse = {
      status: 200,
      data: {
        success: true,
        data: { isGreenModeOn: false }
      }
    }
    axios.patch.mockResolvedValue(mockResponse)

    const patchPayload = { isGreenModeOn: false }

    const result = await service.callInstallationsAPI('123456', 'patch-dynamic-ess-settings', 'PATCH', patchPayload)

    expect(axios.patch).toHaveBeenCalledWith(
      'https://vrmapi.victronenergy.com/v2/installations/123456/dynamic-ess-settings',
      patchPayload,
      expect.any(Object)
    )
    expect(result.success).toBe(true)
    expect(result.method).toBe('patch')
  })

  it('should ignore payload for GET requests', async () => {
    const mockResponse = { status: 200, data: { success: true } }
    axios.get.mockResolvedValue(mockResponse)

    // Pass a payload, but it should be ignored for GET
    await service.callInstallationsAPI('123456', 'basic', 'GET', { ignored: 'data' })

    expect(axios.get).toHaveBeenCalledWith(
      'https://vrmapi.victronenergy.com/v2/installations/123456/basic',
      expect.any(Object)
    )
    // Axios.get doesn't receive the payload as a parameter
  })
})
