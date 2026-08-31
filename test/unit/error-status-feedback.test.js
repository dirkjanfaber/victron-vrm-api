// test/unit/error-status-feedback.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')
const vrmApiNode = require('../../src/nodes/vrm-api.js')

helper.init(require.resolve('node-red'))

const TOKEN = 'test_token_64_characters_long_abcdef0123456789abcdef012345'

const baseFlow = [
  { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
  {
    id: 'vrm1',
    type: 'vrm-api',
    name: 'Test VRM API',
    vrm: 'config1',
    api_type: 'users',
    users: 'me',
    wires: [['helper1']]
  },
  { id: 'helper1', type: 'helper' }
]

const credentials = { config1: { token: TOKEN } }

function mockFetchError (status) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn().mockResolvedValue({ error: 'error' })
  })
}

function expectStatusText (statusText, done) {
  helper.load([configNode, vrmApiNode], baseFlow, credentials, () => {
    const vrmNode = helper.getNode('vrm1')
    const statusCalls = []

    vrmNode.on('call:status', (call) => {
      statusCalls.push(call.args[0])
      const errorStatus = statusCalls.find(s => s.fill === 'red')
      if (errorStatus) {
        expect(errorStatus.text).toBe(statusText)
        done()
      }
    })

    vrmNode.receive({ payload: 'trigger' })
  })
}

describe('Error status feedback', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
    jest.clearAllMocks()
  })

  it('should show "Invalid API token" on 401', (done) => {
    mockFetchError(401)
    expectStatusText('Invalid API token', done)
  })

  it('should show "Access denied" on 403', (done) => {
    mockFetchError(403)
    expectStatusText('Access denied', done)
  })

  it('should show "Rate limited by API" on 429', (done) => {
    mockFetchError(429)
    expectStatusText('Rate limited by API', done)
  })

  it('should show "Error 500" on other HTTP errors', (done) => {
    mockFetchError(500)
    expectStatusText('Error 500', done)
  })

  it('should show "No response from VRM API" when there is no HTTP response', (done) => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connect ETIMEDOUT'))
    expectStatusText('No response from VRM API', done)
  })
})

describe('Token trimming', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
    jest.clearAllMocks()
  })

  it('should trim a token with a trailing newline and make a successful API call', (done) => {
    const flow = [
      { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
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

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true, user: { id: 1, name: 'Test', email: 'test@example.com' } })
    })

    helper.load([configNode, vrmApiNode], flow, { config1: { token: TOKEN + '\n' } }, () => {
      const vrmNode = helper.getNode('vrm1')
      const helperNode = helper.getNode('helper1')

      helperNode.on('input', () => {
        const calledHeaders = global.fetch.mock.calls[0][1].headers
        expect(calledHeaders['X-Authorization']).toBe(`Token ${TOKEN}`)
        done()
      })

      vrmNode.receive({ payload: 'trigger' })
    })
  })

  it('should trim a token with leading and trailing whitespace', (done) => {
    const flow = [
      { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
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

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true, user: { id: 1, name: 'Test', email: 'test@example.com' } })
    })

    helper.load([configNode, vrmApiNode], flow, { config1: { token: '  ' + TOKEN + '  ' } }, () => {
      const vrmNode = helper.getNode('vrm1')
      const helperNode = helper.getNode('helper1')

      helperNode.on('input', () => {
        const calledHeaders = global.fetch.mock.calls[0][1].headers
        expect(calledHeaders['X-Authorization']).toBe(`Token ${TOKEN}`)
        done()
      })

      vrmNode.receive({ payload: 'trigger' })
    })
  })
})
