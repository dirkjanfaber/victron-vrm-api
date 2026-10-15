// test/unit/dess-stats-status.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')
const vrmApiNode = require('../../src/nodes/vrm-api.js')

helper.init(require.resolve('node-red'))

const flow = [
  { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
  {
    id: 'vrm1',
    type: 'vrm-api',
    name: 'Test DESS stats',
    vrm: 'config1',
    api_type: 'installations',
    installations: 'stats',
    idSite: '102195',
    attribute: 'dynamic_ess',
    stats_interval: 'hours',
    wires: [['helper1']]
  },
  { id: 'helper1', type: 'helper' }
]

const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

// Shaped like a real dynamic_ess response: the first total is a summed forecast
const dessResponse = {
  success: true,
  records: {
    vrm_to_grid_fc: [[1792022400000, 120], [1792026000000, 49]],
    vrm_soc_plan: [[1792022400000, 47.4], [1792026000000, 52.1]],
    Pg: false
  },
  totals: { vrm_to_grid_fc: 169, vrm_soc_plan: 99.5, Pg: false }
}

describe('Dynamic ESS stats status', () => {
  beforeEach((done) => {
    helper.startServer(done)
  })

  afterEach((done) => {
    helper.unload()
    helper.stopServer(done)
  })

  it('should show the number of planned intervals instead of the first total', (done) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify(dessResponse))
    })

    helper.load([configNode, vrmApiNode], flow, credentials, () => {
      const vrmNode = helper.getNode('vrm1')

      helper.getNode('helper1').on('input', (msg) => {
        try {
          expect(msg.payload).toEqual(dessResponse)
          const statusCalls = vrmNode.status.args.map(a => a[0])
          expect(statusCalls[statusCalls.length - 1]).toEqual({ fill: 'green', shape: 'dot', text: '2 intervals' })
          done()
        } catch (err) {
          done(err)
        }
      })

      vrmNode.receive({ payload: 'trigger' })
    })
  })
})
