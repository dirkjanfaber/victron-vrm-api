// test/unit/base-load-status.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')
const vrmApiNode = require('../../src/nodes/vrm-api.js')

jest.mock('axios')
const axios = require('axios')

helper.init(require.resolve('node-red'))

const flow = [
  { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
  {
    id: 'vrm1',
    type: 'vrm-api',
    name: 'Test Stats',
    vrm: 'config1',
    api_type: 'installations',
    installations: 'stats',
    idSite: '102195',
    attribute: 'vrm_consum_base',
    stats_interval: 'days',
    wires: [['helper1']]
  },
  { id: 'helper1', type: 'helper' }
]

const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

// live_feed_kwh returns total_solar_yield before total_consumption (issue #70)
const liveFeedResponse = {
  success: true,
  records: {
    total_solar_yield: [[1791540000000, 7.5]],
    total_consumption: [[1791540000000, 12]],
    dhE: [[1791540000000, 3]],
    evE: [[1791540000000, 2]],
    daE: [[1791540000000, 1]]
  },
  totals: { total_solar_yield: 7.5, total_consumption: 12, dhE: 3, evE: 2, daE: 1 }
}

describe('Base load consumption status', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
    jest.clearAllMocks()
  })

  it('should show the computed base load in the status, not the first live_feed_kwh total', (done) => {
    axios.get = jest.fn().mockResolvedValue({ status: 200, data: liveFeedResponse })

    helper.load([configNode, vrmApiNode], flow, credentials, () => {
      const vrmNode = helper.getNode('vrm1')
      const helperNode = helper.getNode('helper1')

      helperNode.on('input', (msg) => {
        try {
          expect(msg.payload.totals).toEqual({ base_load: 6 })
          const statusCalls = vrmNode.status.args.map(a => a[0])
          expect(statusCalls[statusCalls.length - 1]).toEqual({ fill: 'green', shape: 'dot', text: 'base load: 6.0' })
          done()
        } catch (err) {
          done(err)
        }
      })

      vrmNode.receive({ payload: 'trigger' })
    })
  })
})
