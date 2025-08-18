// test/unit/widget.ev-charger.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')
const vrmApiNode = require('../../src/nodes/vrm-api.js')
const VRMAPIService = require('../../src/services/vrm-api-service')

// Mock axios to avoid actual HTTP calls in unit tests
jest.mock('axios')
const axios = require('axios')

// Initialize test helper
helper.init(require.resolve('node-red'))

describe('EV Charger Widget Tests', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
    jest.clearAllMocks()
  })

  describe('VRMAPIService - callWidgetsAPI for EvChargerSummary', () => {
    let service

    beforeEach(() => {
      service = new VRMAPIService('test_token_64_characters_long_abcdef0123456789abcdef012345')
    })

    it('should call EvChargerSummary widget with default instance', async () => {
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              hasOldData: false,
              secondsAgo: { value: 0, valueFormattedWithUnit: '0s' }
            },
            meta: {
              815: { code: 'evmi', description: 'Max current', formatValueOnly: '%.0F', formatWithUnit: '%.0F A', axisGroup: null },
              821: { code: 'evt', description: 'Charging time', formatValueOnly: '%d', formatWithUnit: '%d', axisGroup: null },
              822: { code: 'evi', description: 'Current', formatValueOnly: '%.1F', formatWithUnit: '%.1F A', axisGroup: null },
              823: { code: 'evm', description: 'Mode', formatValueOnly: '%s', formatWithUnit: '%s', axisGroup: null },
              824: { code: 'evs', description: 'Status', formatValueOnly: '%s', formatWithUnit: '%s', axisGroup: null }
            },
            attributeOrder: [824, 821, 823, 822, 815]
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockResponse)

      const result = await service.callWidgetsAPI('123456', 'EvChargerSummary')

      expect(axios.get).toHaveBeenCalledWith(
        'https://vrmapi.victronenergy.com/v2/installations/123456/widgets/EvChargerSummary',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345'
          })
        })
      )

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data.records.meta).toBeDefined()
      expect(result.data.records.meta['824'].description).toBe('Status')
    })

    it('should call EvChargerSummary widget with specific instance', async () => {
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              815: {
                code: 'evmi',
                idDataAttribute: 815,
                secondsAgo: 640,
                secondsToNextLog: 60,
                value: '32',
                valueFloat: 32,
                dataType: 'float',
                dbusServiceType: 'evcharger',
                dbusPath: '/MaxCurrent',
                instance: 40,
                dataAttributeName: 'Max current',
                formattedValue: '32 A',
                hasOldData: false
              },
              824: {
                code: 'evs',
                idDataAttribute: 824,
                secondsAgo: 20,
                secondsToNextLog: 60,
                value: 'EV Disconnected',
                valueFloat: null,
                dataType: 'enum',
                dbusServiceType: 'evcharger',
                dbusPath: '/Status',
                instance: 40,
                dataAttributeName: 'Status',
                formattedValue: 'EV Disconnected',
                hasOldData: false,
                dataAttributeEnumValues: [
                  { nameEnum: 'EV Disconnected', valueEnum: 0 },
                  { nameEnum: 'Connected', valueEnum: 1 },
                  { nameEnum: 'Charging', valueEnum: 2 },
                  { nameEnum: 'Charged', valueEnum: 3 },
                  { nameEnum: 'Waiting for sun', valueEnum: 4 }
                ]
              }
            },
            meta: {
              815: { code: 'evmi', description: 'Max current', formatValueOnly: '%.0F', formatWithUnit: '%.0F A' },
              824: { code: 'evs', description: 'Status', formatValueOnly: '%s', formatWithUnit: '%s' }
            },
            attributeOrder: [824, 815]
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockResponse)

      const result = await service.callWidgetsAPI('123456', 'EvChargerSummary', 40)

      expect(axios.get).toHaveBeenCalledWith(
        'https://vrmapi.victronenergy.com/v2/installations/123456/widgets/EvChargerSummary?instance=40',
        expect.any(Object)
      )

      expect(result.success).toBe(true)
      expect(result.data.records.data['824'].value).toBe('EV Disconnected')
      expect(result.data.records.data['824'].instance).toBe(40)

      // Verify we keep original status descriptions unchanged
      expect(result.data.records.data['824'].formattedValue).toBe('EV Disconnected')
    })

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { error: 'Widget not found' }
        },
        message: 'Request failed'
      }

      axios.get = jest.fn().mockRejectedValue(mockError)

      const result = await service.callWidgetsAPI('999999', 'EvChargerSummary')

      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
      expect(result.data).toEqual({ error: 'Widget not found' })
      expect(result.error).toBe('Request failed')
    })

    it('should detect empty instance data and provide helpful status', async () => {
      const mockEmptyResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              hasOldData: false,
              secondsAgo: { value: 0, valueFormattedWithUnit: '0s' }
            },
            meta: {
              815: { code: 'evmi', description: 'Max current' },
              824: { code: 'evs', description: 'Status' }
            },
            attributeOrder: [824, 815]
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockEmptyResponse)

      const result = await service.callWidgetsAPI('123456', 'EvChargerSummary', 0)

      expect(result.success).toBe(true)

      // Check if the response has actual device data (not just metadata)
      const hasActualData = Object.keys(result.data.records.data).some(key =>
        key !== 'hasOldData' && key !== 'secondsAgo' &&
        typeof result.data.records.data[key] === 'object' &&
        result.data.records.data[key].value !== undefined
      )

      expect(hasActualData).toBe(false) // Should be false for default instance with no data
    })

    it('should distinguish between empty data and actual EV charger data', async () => {
      // Test with actual data
      const mockDataResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              824: {
                code: 'evs',
                value: 'EV Disconnected',
                instance: 40,
                dataAttributeName: 'Status'
              }
            }
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockDataResponse)
      const resultWithData = await service.callWidgetsAPI('123456', 'EvChargerSummary', 40)

      const hasActualData = Object.keys(resultWithData.data.records.data).some(key =>
        key !== 'hasOldData' && key !== 'secondsAgo' &&
        typeof resultWithData.data.records.data[key] === 'object' &&
        resultWithData.data.records.data[key].value !== undefined
      )

      expect(hasActualData).toBe(true) // Should be true when we have actual device data
    })
  })

  describe('Node-RED Integration - EV Charger Widget', () => {
    it('should process EvChargerSummary widget request through Node-RED node', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test EV Charger Widget',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'EvChargerSummary',
          idSite: '123456',
          instance: '40',
          wires: [['helper1']]
        },
        {
          id: 'helper1',
          type: 'helper'
        }
      ]

      const credentials = {
        config1: {
          token: 'test_token_64_characters_long_abcdef0123456789abcdef012345'
        }
      }

      const mockResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              824: {
                code: 'evs',
                value: 'EV Disconnected',
                dataAttributeName: 'Status',
                formattedValue: 'EV Disconnected',
                instance: 40
              }
            }
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockResponse)

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          try {
            expect(msg.payload.success).toBe(true)
            expect(msg.topic).toBe('widgets EvChargerSummary')
            expect(axios.get).toHaveBeenCalledWith(
              'https://vrmapi.victronenergy.com/v2/installations/123456/widgets/EvChargerSummary?instance=40',
              expect.any(Object)
            )
            done()
          } catch (error) {
            done(error)
          }
        })

        vrmNode.receive({ payload: 'trigger' })
      })
    })

    it('should handle empty widget data gracefully and suggest instance values', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test EV Charger Widget Default',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'EvChargerSummary',
          idSite: '123456',
          // No instance specified - should use default
          wires: [['helper1']]
        },
        {
          id: 'helper1',
          type: 'helper'
        }
      ]

      const credentials = {
        config1: {
          token: 'test_token_64_characters_long_abcdef0123456789abcdef012345'
        }
      }

      const mockEmptyResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              hasOldData: false,
              secondsAgo: { value: 0, valueFormattedWithUnit: '0s' }
            },
            meta: {
              815: { code: 'evmi', description: 'Max current' },
              824: { code: 'evs', description: 'Status' }
            }
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockEmptyResponse)

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          try {
            expect(msg.payload.success).toBe(true)
            expect(msg.topic).toBe('widgets EvChargerSummary')

            // Check that we got minimal data (no actual device data)
            const hasActualData = Object.keys(msg.payload.records.data).some(key =>
              key !== 'hasOldData' && key !== 'secondsAgo' &&
              typeof msg.payload.records.data[key] === 'object' &&
              msg.payload.records.data[key].value !== undefined
            )

            expect(hasActualData).toBe(false)
            done()
          } catch (error) {
            done(error)
          }
        })

        vrmNode.receive({ payload: 'trigger' })
      })
    })

    it('should preserve original EV charger status values without modification', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test EV Charger Status',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'EvChargerSummary',
          idSite: '123456',
          instance: '40',
          wires: [['helper1']]
        },
        {
          id: 'helper1',
          type: 'helper'
        }
      ]

      const credentials = {
        config1: {
          token: 'test_token_64_characters_long_abcdef0123456789abcdef012345'
        }
      }

      const mockResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              824: {
                code: 'evs',
                value: 'Waiting for sun',
                dataAttributeName: 'Status',
                formattedValue: 'Waiting for sun',
                instance: 40
              }
            }
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockResponse)

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          try {
            // Verify original status values are preserved exactly as from API
            expect(msg.payload.records.data['824'].value).toBe('Waiting for sun')
            expect(msg.payload.records.data['824'].formattedValue).toBe('Waiting for sun')
            // No modification or rewording of the original status
            done()
          } catch (error) {
            done(error)
          }
        })

        vrmNode.receive({ payload: 'trigger' })
      })
    })

    it('should show yellow status when no EV charger data is found', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test EV Charger No Data',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'EvChargerSummary',
          idSite: '123456',
          // No instance specified - should use default and get no data
          wires: [['helper1']]
        },
        {
          id: 'helper1',
          type: 'helper'
        }
      ]

      const credentials = {
        config1: {
          token: 'test_token_64_characters_long_abcdef0123456789abcdef012345'
        }
      }

      const mockEmptyResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              hasOldData: false,
              secondsAgo: { value: 0, valueFormattedWithUnit: '0s' }
            },
            meta: {
              815: { code: 'evmi', description: 'Max current' },
              824: { code: 'evs', description: 'Status' }
            }
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockEmptyResponse)

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          try {
            expect(msg.payload.success).toBe(true)

            // Check node status for yellow indicator with correct message
            setTimeout(() => {
              const nodeStatus = vrmNode.status.lastCall ? vrmNode.status.lastCall.args[0] : null
              expect(nodeStatus).toBeTruthy()
              expect(nodeStatus.fill).toBe('yellow')
              expect(nodeStatus.shape).toBe('dot')
              expect(nodeStatus.text).toBe('No data - incorrect instance?')
              done()
            }, 10) // Small delay to ensure status is set
          } catch (error) {
            done(error)
          }
        })

        vrmNode.receive({ payload: 'trigger' })
      })
    })

    it('should show green status with EV charger status when data is available', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test EV Charger With Data',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'EvChargerSummary',
          idSite: '123456',
          instance: '40',
          wires: [['helper1']]
        },
        {
          id: 'helper1',
          type: 'helper'
        }
      ]

      const credentials = {
        config1: {
          token: 'test_token_64_characters_long_abcdef0123456789abcdef012345'
        }
      }

      const mockResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              824: {
                code: 'evs',
                value: 'EV Disconnected',
                dataAttributeName: 'Status',
                formattedValue: 'EV Disconnected',
                instance: 40
              }
            }
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockResponse)

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          try {
            expect(msg.payload.success).toBe(true)
            expect(msg.payload.records.data['824'].formattedValue).toBe('EV Disconnected')

            // Check node status for green indicator with EV charger status
            setTimeout(() => {
              const nodeStatus = vrmNode.status.lastCall ? vrmNode.status.lastCall.args[0] : null
              expect(nodeStatus).toBeTruthy()
              expect(nodeStatus.fill).toBe('green')
              expect(nodeStatus.shape).toBe('dot')
              expect(nodeStatus.text).toBe('EV Disconnected')
              done()
            }, 10) // Small delay to ensure status is set
          } catch (error) {
            done(error)
          }
        })

        vrmNode.receive({ payload: 'trigger' })
      })
    })
  })
})
