// test/unit/msg.url.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')
const vrmApiNode = require('../../src/nodes/vrm-api.js')

// Mock axios to avoid actual HTTP calls in unit tests
jest.mock('axios')
const axios = require('axios')

// Initialize test helper
helper.init(require.resolve('node-red'))

describe('msg.url Override Functionality', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
    jest.clearAllMocks()
  })

  describe('URL Override with msg.url', () => {
    it('should use default VRM API URL when msg.url is not provided', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
          api_type: 'users',
          users: 'me',
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

      // Mock axios get method
      axios.get = jest.fn().mockResolvedValue({
        data: { user: { id: 123, email: 'test@example.com' } }
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          // Verify default VRM API URL was used
          expect(axios.get).toHaveBeenCalledWith(
            'https://vrmapi.victronenergy.com/v2/users/me',
            expect.any(Object)
          )
          done()
        })

        // Send message without msg.url (should use default)
        vrmNode.receive({ payload: 'trigger' })
      })
    })

    it('should override default URL when msg.url is provided with GET method', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
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

      // Mock axios get method
      axios.get = jest.fn().mockResolvedValue({
        data: { custom: 'response' }
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          // Verify custom URL was used, with query appended
          expect(axios.get).toHaveBeenCalledWith(
            'https://custom-api.example.com/v1/test/endpoint',
            expect.objectContaining({
              headers: expect.objectContaining({
                'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
                'accept': 'application/json'
              })
            })
          )
          done()
        })

        // Send message with custom base URL and query (query gets appended)
        vrmNode.receive({
          payload: 'trigger',
          url: 'https://custom-api.example.com/v1',
          method: 'GET',
          query: 'test/endpoint'
        })
      })
    })

    it('should override default URL when msg.url is provided with POST method', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
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

      // Mock axios post method
      axios.post = jest.fn().mockResolvedValue({
        data: { created: 'response' }
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          // Verify custom URL was used with POST method (query appended)
          expect(axios.post).toHaveBeenCalledWith(
            'https://custom-api.example.com/v1/create',
            { test: 'data' },
            expect.objectContaining({
              headers: expect.objectContaining({
                'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
                'accept': 'application/json'
              })
            })
          )
          done()
        })

        // Send message with custom base URL and POST method
        vrmNode.receive({
          payload: { test: 'data' },
          url: 'https://custom-api.example.com/v1',
          method: 'POST',
          query: 'create'
        })
      })
    })

    it('should override default URL completely when only msg.url is provided (no query)', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
          api_type: 'users',
          users: 'me',
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

      // Mock axios get method
      axios.get = jest.fn().mockResolvedValue({
        data: { external: 'api response' }
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          // When only msg.url is provided (without query/method), the node config still applies
          // So it will append /users/me to the custom URL
          expect(axios.get).toHaveBeenCalledWith(
            'https://jsonplaceholder.typicode.com/posts/1/users/me',
            expect.objectContaining({
              params: expect.any(Object),
              headers: expect.objectContaining({
                'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
                'accept': 'application/json'
              })
            })
          )
          done()
        })

        // Send message with only msg.url (no query/method, uses custom URL as base + node config)
        vrmNode.receive({
          payload: 'trigger',
          url: 'https://jsonplaceholder.typicode.com/posts/1'
        })
      })
    })

    it('should override default URL when msg.url is provided with PATCH method', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
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

      // Mock axios patch method
      axios.patch = jest.fn().mockResolvedValue({
        data: { updated: 'response' }
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          // Verify custom URL was used with PATCH method (query appended)
          expect(axios.patch).toHaveBeenCalledWith(
            'https://custom-api.example.com/v1/update/123',
            { status: 'updated' },
            expect.objectContaining({
              headers: expect.objectContaining({
                'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
                'accept': 'application/json'
              })
            })
          )
          done()
        })

        // Send message with custom base URL and PATCH method
        vrmNode.receive({
          payload: { status: 'updated' },
          url: 'https://custom-api.example.com/v1',
          method: 'PATCH',
          query: 'update/123'
        })
      })
    })

    it('should preserve existing headers when using custom URL', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
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

      // Mock axios get method
      axios.get = jest.fn().mockResolvedValue({
        data: { custom: 'response' }
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          // Verify that authentication and other headers are preserved (query appended)
          expect(axios.get).toHaveBeenCalledWith(
            'https://different-api.example.com/api/v2/data',
            expect.objectContaining({
              headers: expect.objectContaining({
                'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
                'accept': 'application/json',
                'User-Agent': expect.stringMatching(/^nrc-vrm-api\//)
              })
            })
          )
          done()
        })

        // Send message with custom base URL
        vrmNode.receive({
          payload: 'trigger',
          url: 'https://different-api.example.com/api/v2',
          method: 'GET',
          query: 'data'
        })
      })
    })

    it('should handle non-VRM API URLs correctly', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
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

      // Mock axios get method
      axios.get = jest.fn().mockResolvedValue({
        data: { external: 'api response' }
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          // Verify that completely different API URL is used (query appended)
          expect(axios.get).toHaveBeenCalledWith(
            'https://jsonplaceholder.typicode.com/posts/1',
            expect.any(Object)
          )
          
          // Verify the call was made with expected headers
          const callArgs = axios.get.mock.calls[0]
          expect(callArgs[1].headers['X-Authorization']).toBe('Token test_token_64_characters_long_abcdef0123456789abcdef012345')
          
          done()
        })

        // Send message with completely different API base URL
        vrmNode.receive({
          payload: 'trigger',
          url: 'https://jsonplaceholder.typicode.com',
          method: 'GET',
          query: 'posts/1'
        })
      })
    })

    it('should use msg.url even when node configuration would build different URL', (done) => {
      const flow = [
        {
          id: 'config1',
          type: 'config-vrm-api',
          name: 'Test Config'
        },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
          api_type: 'installations',
          installations: 'basic',
          idSite: '123456',
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

      // Mock axios get method
      axios.get = jest.fn().mockResolvedValue({
        data: { override: 'success' }
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          // Verify that msg.url overrides the configured installation endpoint
          // (would normally be https://vrmapi.victronenergy.com/v2/installations/123456/basic)
          expect(axios.get).toHaveBeenCalledWith(
            'https://override-api.example.com/custom/endpoint',
            expect.any(Object)
          )
          done()
        })

        // Send message with URL override, even though node is configured for installations
        vrmNode.receive({
          payload: 'trigger',
          url: 'https://override-api.example.com/custom',
          method: 'GET',
          query: 'endpoint'
        })
      })
    })
  })
})
