// test/unit/config-vrm-api-ipv4.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')

// Initialize test helper
helper.init(require.resolve('node-red'))

describe('config-vrm-api IPv4 Configuration', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
  })

  it('should default forceIpv4 to false when not specified', (done) => {
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

      expect(configNodeInstance).toBeDefined()
      expect(configNodeInstance.forceIpv4).toBe(false)

      done()
    })
  })

  it('should respect forceIpv4 configuration when set to true', (done) => {
    const flow = [
      {
        id: 'config1',
        type: 'config-vrm-api',
        name: 'Test VRM Config',
        forceIpv4: true
      }
    ]

    const credentials = {
      config1: {
        token: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
      }
    }

    helper.load(configNode, flow, credentials, () => {
      const configNodeInstance = helper.getNode('config1')

      expect(configNodeInstance).toBeDefined()
      expect(configNodeInstance.forceIpv4).toBe(true)

      done()
    })
  })

  it('should respect forceIpv4 configuration when explicitly set to false', (done) => {
    const flow = [
      {
        id: 'config1',
        type: 'config-vrm-api',
        name: 'Test VRM Config',
        forceIpv4: false
      }
    ]

    const credentials = {
      config1: {
        token: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
      }
    }

    helper.load(configNode, flow, credentials, () => {
      const configNodeInstance = helper.getNode('config1')

      expect(configNodeInstance).toBeDefined()
      expect(configNodeInstance.forceIpv4).toBe(false)

      done()
    })
  })
})
