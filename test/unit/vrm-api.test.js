// test/unit/vrm-api.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')
const vrmApiNode = require('../../src/nodes/vrm-api.js')

// Mock axios to avoid actual HTTP calls in unit tests
jest.mock('axios')
const axios = require('axios')

// Initialize test helper
helper.init(require.resolve('node-red'))

describe('vrm-api Node', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
    jest.clearAllMocks()
  })

  it('should be loaded with correct defaults', (done) => {
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
        users: 'me'
      }
    ]

    const credentials = {
      config1: {
        token: 'test_token_64_characters_long_abcdef0123456789abcdef012345'
      }
    }

    helper.load([configNode, vrmApiNode], flow, credentials, () => {
      const vrmNode = helper.getNode('vrm1')
      const configNodeInstance = helper.getNode('config1')
      
      // Verify nodes were created
      expect(vrmNode).toBeDefined()
      expect(vrmNode.name).toBe('Test VRM API')
      expect(vrmNode.type).toBe('vrm-api')
      
      // Verify config node is linked
      expect(configNodeInstance).toBeDefined()
      
      done()
    })
  })

  it('should construct correct API URL for users/me endpoint', (done) => {
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

      // Listen for output
      helperNode.on('input', (msg) => {
        // Verify axios was called with correct parameters
        expect(axios.get).toHaveBeenCalledWith(
          'https://vrmapi.victronenergy.com/v2/users/me',
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

      // Wait a bit to let rate limiting pass, then send message
      setTimeout(() => {
        vrmNode.receive({ payload: 'trigger' })
      }, 6000)
    })
  }, 10000) // Increase timeout for this test

  it('should handle custom query via msg properties', (done) => {
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
        // Verify custom URL was used
        expect(axios.get).toHaveBeenCalledWith(
          'https://vrmapi.victronenergy.com/v2/custom/endpoint',
          expect.any(Object)
        )
        
        expect(msg.topic).toBe('custom')
        done()
      })

      // Send message with custom query
      vrmNode.receive({
        payload: 'trigger',
        query: 'custom/endpoint',
        method: 'GET'
      })
    })
  })
})
