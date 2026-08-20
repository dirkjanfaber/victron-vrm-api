// test/unit/msg.url.test.js
const helper = require('node-red-node-test-helper')
const configNode = require('../../src/nodes/config-vrm-api.js')
const vrmApiNode = require('../../src/nodes/vrm-api.js')

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

      const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ user: { id: 123, email: 'test@example.com' } })
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          expect(global.fetch).toHaveBeenCalledWith(
            'https://vrmapi.victronenergy.com/v2/users/me',
            expect.any(Object)
          )
          done()
        })

        vrmNode.receive({ payload: 'trigger' })
      })
    })

    it('should override default URL when msg.url is provided with GET method', (done) => {
      const flow = [
        { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
          wires: [['helper1']]
        },
        { id: 'helper1', type: 'helper' }
      ]

      const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ custom: 'response' })
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          expect(global.fetch).toHaveBeenCalledWith(
            'https://custom-api.example.com/v1/test/endpoint',
            expect.objectContaining({
              headers: expect.objectContaining({
                'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
                accept: 'application/json'
              })
            })
          )
          done()
        })

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
        { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
          wires: [['helper1']]
        },
        { id: 'helper1', type: 'helper' }
      ]

      const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ created: 'response' })
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          expect(global.fetch).toHaveBeenCalledWith(
            'https://custom-api.example.com/v1/create',
            expect.objectContaining({
              method: 'POST',
              headers: expect.objectContaining({
                'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
                accept: 'application/json'
              })
            })
          )
          done()
        })

        vrmNode.receive({
          payload: { test: 'data' },
          url: 'https://custom-api.example.com/v1',
          method: 'POST',
          query: 'create'
        })
      })
    })

    it('should override default URL when msg.url is provided with PATCH method', (done) => {
      const flow = [
        { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
          wires: [['helper1']]
        },
        { id: 'helper1', type: 'helper' }
      ]

      const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ updated: 'response' })
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          expect(global.fetch).toHaveBeenCalledWith(
            'https://custom-api.example.com/v1/update/123',
            expect.objectContaining({
              method: 'PATCH',
              headers: expect.objectContaining({
                'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
                accept: 'application/json'
              })
            })
          )
          done()
        })

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
        { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
          wires: [['helper1']]
        },
        { id: 'helper1', type: 'helper' }
      ]

      const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ custom: 'response' })
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          expect(global.fetch).toHaveBeenCalledWith(
            'https://different-api.example.com/api/v2/data',
            expect.objectContaining({
              headers: expect.objectContaining({
                'X-Authorization': 'Token test_token_64_characters_long_abcdef0123456789abcdef012345',
                accept: 'application/json',
                'User-Agent': expect.stringMatching(/^nrc-vrm-api\//)
              })
            })
          )
          done()
        })

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
        { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
        {
          id: 'vrm1',
          type: 'vrm-api',
          name: 'Test VRM API',
          vrm: 'config1',
          wires: [['helper1']]
        },
        { id: 'helper1', type: 'helper' }
      ]

      const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ external: 'api response' })
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          expect(global.fetch).toHaveBeenCalledWith(
            'https://jsonplaceholder.typicode.com/posts/1',
            expect.any(Object)
          )

          const calledHeaders = global.fetch.mock.calls[0][1].headers
          expect(calledHeaders['X-Authorization']).toBe('Token test_token_64_characters_long_abcdef0123456789abcdef012345')

          done()
        })

        vrmNode.receive({
          payload: 'trigger',
          url: 'https://jsonplaceholder.typicode.com',
          method: 'GET',
          query: 'posts/1'
        })
      })
    })

    it('should use msg.url as base URL for standard installations calls', (done) => {
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
          attribute: 'dhE',
          stats_interval: 'hours',
          wires: [['helper1']]
        },
        { id: 'helper1', type: 'helper' }
      ]

      const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true, records: {}, totals: {} })
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', () => {
          const calledUrl = global.fetch.mock.calls[0][0]
          expect(calledUrl).toMatch(/^https:\/\/betavrmapi\.victronenergy\.com\/v2\/installations\/102195\/stats/)
          done()
        })

        vrmNode.receive({ payload: 'trigger', url: 'https://betavrmapi.victronenergy.com/v2' })
      })
    })

    it('should use msg.url even when node configuration would build different URL', (done) => {
      const flow = [
        { id: 'config1', type: 'config-vrm-api', name: 'Test Config' },
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
        { id: 'helper1', type: 'helper' }
      ]

      const credentials = { config1: { token: 'test_token_64_characters_long_abcdef0123456789abcdef012345' } }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ override: 'success' })
      })

      helper.load([configNode, vrmApiNode], flow, credentials, () => {
        const vrmNode = helper.getNode('vrm1')
        const helperNode = helper.getNode('helper1')

        helperNode.on('input', (msg) => {
          expect(global.fetch).toHaveBeenCalledWith(
            'https://override-api.example.com/custom/endpoint',
            expect.any(Object)
          )
          done()
        })

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
