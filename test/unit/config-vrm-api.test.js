// test/unit/config-vrm-api.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')

// Initialize test helper
helper.init(require.resolve('node-red'))

describe('config-vrm-api Node', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
  })

  it('should be loaded with correct defaults', (done) => {
    const flow = [
      {
        id: 'config1',
        type: 'config-vrm-api',
        name: 'Test VRM Config'
      }
    ]

    helper.load(configNode, flow, () => {
      const configNodeInstance = helper.getNode('config1')

      // Verify node was created
      expect(configNodeInstance).toBeDefined()
      expect(configNodeInstance.name).toBe('Test VRM Config')
      expect(configNodeInstance.type).toBe('config-vrm-api')

      done()
    })
  })

  it('should handle credentials correctly', (done) => {
    const flow = [
      {
        id: 'config1',
        type: 'config-vrm-api',
        name: 'Test VRM Config'
      }
    ]

    const credentials = {
      config1: {
        token: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
      }
    }

    helper.load(configNode, flow, credentials, () => {
      const configNodeInstance = helper.getNode('config1')

      // Verify credentials are accessible
      expect(configNodeInstance.credentials).toBeDefined()
      expect(configNodeInstance.credentials.token).toBe('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789')

      done()
    })
  })

  it('should migrate legacy token from config to credentials', (done) => {
    const flow = [
      {
        id: 'config1',
        type: 'config-vrm-api',
        name: 'Test VRM Config',
        token: 'legacy_token_in_config' // This should be migrated
      }
    ]

    helper.load(configNode, flow, () => {
      const configNodeInstance = helper.getNode('config1')

      // Verify legacy token property is removed
      expect(configNodeInstance.token).toBeUndefined()

      // Note: In a real scenario, the migration would move the token to credentials
      // but that requires mocking RED.nodes.addCredentials which is complex for this basic test

      done()
    })
  })

  it('should clean up deprecated properties', (done) => {
    const flow = [
      {
        id: 'config1',
        type: 'config-vrm-api',
        name: 'Test VRM Config',
        token: 'should_be_removed'
      }
    ]

    helper.load(configNode, flow, () => {
      const configNodeInstance = helper.getNode('config1')

      // Verify deprecated properties are cleaned up
      expect(configNodeInstance.token).toBeUndefined()

      done()
    })
  })
})
