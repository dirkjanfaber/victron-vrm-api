// test/unit/widget-temperature.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')
const vrmApiNode = require('../../src/nodes/vrm-api.js')
const VRMAPIService = require('../../src/services/vrm-api-service')

// Mock axios to avoid actual HTTP calls in unit tests
jest.mock('axios')
const axios = require('axios')

// Initialize test helper
helper.init(require.resolve('node-red'))

describe('Temperature Widget Tests', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
    jest.clearAllMocks()
  })

  describe('VRMAPIService - callWidgetsAPI for TempSummaryAndGraph', () => {
    let service

    beforeEach(() => {
      service = new VRMAPIService('test_token_64_characters_long_abcdef0123456789abcdef012345')
    })

    it('should call TempSummaryAndGraph widget with default instance', async () => {
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
              450: { code: 'tsT', description: 'Temperature', formatValueOnly: '%.1F', formatWithUnit: '%.1F°C', axisGroup: null }
            },
            attributeOrder: [450]
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockResponse)

      const result = await service.callWidgetsAPI('123456', 'TempSummaryAndGraph')

      expect(axios.get).toHaveBeenCalledWith(
        'https://vrmapi.victronenergy.com/v2/installations/123456/widgets/TempSummaryAndGraph',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345'
          })
        })
      )

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data.records.meta).toBeDefined()
      expect(result.data.records.meta['450'].description).toBe('Temperature')
    })

    it('should call TempSummaryAndGraph widget with specific instance', async () => {
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              450: {
                code: 'tsT',
                idDataAttribute: 450,
                secondsAgo: 30,
                secondsToNextLog: 60,
                value: '23.5',
                valueFloat: 23.5,
                dataType: 'float',
                dbusServiceType: 'temperature',
                dbusPath: '/Temperature',
                instance: 20,
                dataAttributeName: 'Temperature',
                formattedValue: '23.5°C',
                hasOldData: false
              }
            },
            meta: {
              450: { code: 'tsT', description: 'Temperature', formatValueOnly: '%.1F', formatWithUnit: '%.1F°C' }
            },
            attributeOrder: [450]
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockResponse)

      const result = await service.callWidgetsAPI('123456', 'TempSummaryAndGraph', 20)

      expect(axios.get).toHaveBeenCalledWith(
        'https://vrmapi.victronenergy.com/v2/installations/123456/widgets/TempSummaryAndGraph?instance=20',
        expect.any(Object)
      )

      expect(result.success).toBe(true)
      expect(result.data.records.data['450'].value).toBe('23.5')
      expect(result.data.records.data['450'].instance).toBe(20)

      // Verify we keep original temperature values unchanged
      expect(result.data.records.data['450'].formattedValue).toBe('23.5°C')
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

      const result = await service.callWidgetsAPI('999999', 'TempSummaryAndGraph')

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
              450: { code: 'tsT', description: 'Temperature' }
            },
            attributeOrder: [450]
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockEmptyResponse)

      const result = await service.callWidgetsAPI('123456', 'TempSummaryAndGraph', 0)

      expect(result.success).toBe(true)

      // Check if the response has actual device data (not just metadata)
      const hasActualData = Object.keys(result.data.records.data).some(key =>
        key !== 'hasOldData' && key !== 'secondsAgo' &&
        typeof result.data.records.data[key] === 'object' &&
        result.data.records.data[key].value !== undefined
      )

      expect(hasActualData).toBe(false) // Should be false for default instance with no data
    })

    it('should distinguish between empty data and actual temperature data', async () => {
      // Test with actual data
      const mockDataResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              450: {
                code: 'tsT',
                value: '25.3',
                instance: 20,
                dataAttributeName: 'Temperature',
                formattedValue: '25.3°C'
              }
            }
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockDataResponse)
      const resultWithData = await service.callWidgetsAPI('123456', 'TempSummaryAndGraph', 20)

      const hasActualData = Object.keys(resultWithData.data.records.data).some(key =>
        key !== 'hasOldData' && key !== 'secondsAgo' &&
        typeof resultWithData.data.records.data[key] === 'object' &&
        resultWithData.data.records.data[key].value !== undefined
      )

      expect(hasActualData).toBe(true) // Should be true when we have actual device data
    })
  })

  describe('VRMAPIService - interpretWidgetsStatus for Temperature', () => {
    let service

    beforeEach(() => {
      service = new VRMAPIService('test_token_64_characters_long_abcdef0123456789abcdef012345')
    })

    it('should interpret TempSummaryAndGraph with no data (yellow status)', () => {
      const emptyResponse = {
        success: true,
        records: {
          data: {
            hasOldData: false,
            secondsAgo: { value: 0, valueFormattedWithUnit: '0s' }
          },
          meta: {
            450: { code: 'tsT', description: 'Temperature' }
          }
        }
      }

      const result = service.interpretWidgetsStatus(emptyResponse, 'TempSummaryAndGraph', 0)

      expect(result.text).toBe('No data - incorrect instance?')
      expect(result.color).toBe('yellow')
      expect(result.hasData).toBe(false)
      expect(result.raw).toBe(emptyResponse)
    })

    it('should interpret TempSummaryAndGraph with data using data["450"] lookup', () => {
      const dataResponse = {
        success: true,
        records: {
          data: {
            450: {
              code: 'tsT',
              value: '23.5',
              dataAttributeName: 'Temperature',
              formattedValue: '23.5°C',
              instance: 20
            }
          }
        }
      }

      const result = service.interpretWidgetsStatus(dataResponse, 'TempSummaryAndGraph', 20)

      expect(result.text).toBe('Temperature (inst. 20): 23.5°C')
      expect(result.color).toBe('green')
      expect(result.hasData).toBe(true)
      expect(result.temperatureValue).toBe('23.5°C')
      expect(result.raw).toBe(dataResponse)
    })

    it('should interpret TempSummaryAndGraph with data using code lookup', () => {
      const dataResponse = {
        success: true,
        records: {
          data: {
            999: {
              code: 'tsT',
              value: '21.8',
              dataAttributeName: 'Temperature',
              formattedValue: '21.8°C',
              instance: 30
            }
          }
        }
      }

      const result = service.interpretWidgetsStatus(dataResponse, 'TempSummaryAndGraph', 30)

      expect(result.text).toBe('Temperature (inst. 30): 21.8°C')
      expect(result.color).toBe('green')
      expect(result.hasData).toBe(true)
      expect(result.temperatureValue).toBe('21.8°C')
      expect(result.raw).toBe(dataResponse)
    })

    it('should interpret TempSummaryAndGraph with data but no temperature field', () => {
      const dataResponse = {
        success: true,
        records: {
          data: {
            123: {
              code: 'other',
              value: 'some value',
              dataAttributeName: 'Other',
              formattedValue: 'some value',
              instance: 20
            }
          }
        }
      }

      const result = service.interpretWidgetsStatus(dataResponse, 'TempSummaryAndGraph', 20)

      expect(result.text).toBe('Temperature sensor (inst. 20)')
      expect(result.color).toBe('green')
      expect(result.hasData).toBe(true)
      expect(result.temperatureValue).toBeNull()
      expect(result.raw).toBe(dataResponse)
    })

    it('should show warning for invalid temperature data', () => {
      const invalidDataResponse = {
        success: true,
        records: {
          data: {
            450: {
              code: 'tsT',
              value: '57.8',
              dataAttributeName: 'Temperature',
              formattedValue: '57.80 °C',
              instance: 20,
              isValid: 0, // Invalid data
              hasOldData: false
            }
          }
        }
      }

      const result = service.interpretWidgetsStatus(invalidDataResponse, 'TempSummaryAndGraph', 20)

      expect(result.text).toBe('Invalid data')
      expect(result.color).toBe('yellow')
      expect(result.hasData).toBe(true)
      expect(result.hasValidData).toBe(false)
      expect(result.raw).toBe(invalidDataResponse)
    })

    it('should show warning for stale temperature data', () => {
      const staleDataResponse = {
        success: true,
        records: {
          data: {
            450: {
              code: 'tsT',
              value: '22.5',
              dataAttributeName: 'Temperature',
              formattedValue: '22.5 °C',
              instance: 20,
              isValid: 1,
              hasOldData: true // Stale data
            }
          }
        }
      }

      const result = service.interpretWidgetsStatus(staleDataResponse, 'TempSummaryAndGraph', 20)

      expect(result.text).toBe('Stale data - check sensor')
      expect(result.color).toBe('yellow')
      expect(result.hasData).toBe(true)
      expect(result.hasValidData).toBe(false)
      expect(result.raw).toBe(staleDataResponse)
    })
  })

  describe('Node-RED Integration - Temperature Widget', () => {
    it('should process TempSummaryAndGraph widget request through Node-RED node', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test Temperature Widget',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'TempSummaryAndGraph',
          idSite: '123456',
          instance: '20',
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
              450: {
                code: 'tsT',
                value: '24.2',
                dataAttributeName: 'Temperature',
                formattedValue: '24.2°C',
                instance: 20
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
            expect(msg.topic).toBe('widgets TempSummaryAndGraph')
            expect(axios.get).toHaveBeenCalledWith(
              'https://vrmapi.victronenergy.com/v2/installations/123456/widgets/TempSummaryAndGraph?instance=20',
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

    it('should handle empty temperature widget data gracefully', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test Temperature Widget Default',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'TempSummaryAndGraph',
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
              450: { code: 'tsT', description: 'Temperature' }
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
            expect(msg.topic).toBe('widgets TempSummaryAndGraph')

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

    it('should preserve original temperature values without modification', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test Temperature Values',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'TempSummaryAndGraph',
          idSite: '123456',
          instance: '20',
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
              450: {
                code: 'tsT',
                value: '19.7',
                dataAttributeName: 'Temperature',
                formattedValue: '19.7°C',
                instance: 20
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
            // Verify original temperature values are preserved exactly as from API
            expect(msg.payload.records.data['450'].value).toBe('19.7')
            expect(msg.payload.records.data['450'].formattedValue).toBe('19.7°C')
            // No modification or rewording of the original temperature value
            done()
          } catch (error) {
            done(error)
          }
        })

        vrmNode.receive({ payload: 'trigger' })
      })
    })

    it('should show yellow status when no temperature data is found', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test Temperature No Data',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'TempSummaryAndGraph',
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
              450: { code: 'tsT', description: 'Temperature' }
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

    it('should show green status with temperature value when data is available', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test Temperature With Data',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'TempSummaryAndGraph',
          idSite: '123456',
          instance: '20',
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
              450: {
                code: 'tsT',
                value: '22.4',
                dataAttributeName: 'Temperature',
                formattedValue: '22.4°C',
                instance: 20
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
            expect(msg.payload.records.data['450'].formattedValue).toBe('22.4°C')

            // Check node status for green indicator with temperature value
            setTimeout(() => {
              const nodeStatus = vrmNode.status.lastCall ? vrmNode.status.lastCall.args[0] : null
              expect(nodeStatus).toBeTruthy()
              expect(nodeStatus.fill).toBe('green')
              expect(nodeStatus.shape).toBe('dot')
              expect(nodeStatus.text).toBe('Temperature (inst. 20): 22.4°C')
              done()
            }, 10) // Small delay to ensure status is set
          } catch (error) {
            done(error)
          }
        })

        vrmNode.receive({ payload: 'trigger' })
      })
    })

    it('should show yellow status for invalid temperature data', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test Invalid Temperature',
          vrm: 'config1',
          api_type: 'widgets',
          widgets: 'TempSummaryAndGraph',
          idSite: '123456',
          instance: '20',
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

      const mockInvalidResponse = {
        status: 200,
        data: {
          success: true,
          records: {
            data: {
              450: {
                code: 'tsT',
                value: '57.8',
                dataAttributeName: 'Temperature',
                formattedValue: '57.80 °C',
                instance: 20,
                isValid: 0, // Invalid data
                hasOldData: false
              }
            }
          }
        }
      }

      axios.get = jest.fn().mockResolvedValue(mockInvalidResponse)

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          try {
            expect(msg.payload.success).toBe(true)

            // Check node status shows warning for invalid data
            setTimeout(() => {
              const nodeStatus = vrmNode.status.lastCall ? vrmNode.status.lastCall.args[0] : null
              expect(nodeStatus).toBeTruthy()
              expect(nodeStatus.fill).toBe('yellow')
              expect(nodeStatus.shape).toBe('dot')
              expect(nodeStatus.text).toBe('Invalid data')
              done()
            }, 10)
          } catch (error) {
            done(error)
          }
        })

        vrmNode.receive({ payload: 'trigger' })
      })
    })
  })
})
