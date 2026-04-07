// test/unit/vrm-api-node-forcipv4.test.js
//
// Verifies that the vrm-api node passes forceIpv4 from the config node
// through to VRMAPIService, so the axios HTTP agents are actually configured.
const http = require('http')
const https = require('https')
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')
const vrmApiNode = require('../../src/nodes/vrm-api.js')

jest.mock('axios')
const axios = require('axios')

helper.init(require.resolve('node-red'))

const TOKEN = 'test_token_64_characters_long_abcdef0123456789abcdef012345'

describe('vrm-api node forceIpv4 propagation', () => {
  beforeEach((done) => {
    delete axios.defaults.httpAgent
    delete axios.defaults.httpsAgent
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
    jest.clearAllMocks()
  })

  it('should configure IPv4 agents when forceIpv4 is enabled in config node', (done) => {
    const flow = [
      { id: 'config1', type: 'config-vrm-api', name: 'Test Config', forceIpv4: true },
      {
        id: 'vrm1',
        type: 'vrm-api',
        vrm: 'config1',
        api_type: 'users',
        users: 'me',
        wires: [['helper1']]
      },
      { id: 'helper1', type: 'helper' }
    ]

    axios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: { success: true, user: { id: 1, name: 'Test', email: 'test@example.com' } }
    })

    helper.load([configNode, vrmApiNode], flow, { config1: { token: TOKEN } }, () => {
      const vrmNode = helper.getNode('vrm1')
      const helperNode = helper.getNode('helper1')

      helperNode.on('input', () => {
        expect(axios.defaults.httpAgent).toBeInstanceOf(http.Agent)
        expect(axios.defaults.httpsAgent).toBeInstanceOf(https.Agent)
        done()
      })

      vrmNode.receive({ payload: 'trigger' })
    })
  })

  it('should not configure IPv4 agents when forceIpv4 is disabled in config node', (done) => {
    const flow = [
      { id: 'config1', type: 'config-vrm-api', name: 'Test Config', forceIpv4: false },
      {
        id: 'vrm1',
        type: 'vrm-api',
        vrm: 'config1',
        api_type: 'users',
        users: 'me',
        wires: [['helper1']]
      },
      { id: 'helper1', type: 'helper' }
    ]

    axios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: { success: true, user: { id: 1, name: 'Test', email: 'test@example.com' } }
    })

    helper.load([configNode, vrmApiNode], flow, { config1: { token: TOKEN } }, () => {
      const vrmNode = helper.getNode('vrm1')
      const helperNode = helper.getNode('helper1')

      helperNode.on('input', () => {
        expect(axios.defaults.httpAgent).toBeUndefined()
        expect(axios.defaults.httpsAgent).toBeUndefined()
        done()
      })

      vrmNode.receive({ payload: 'trigger' })
    })
  })
})
