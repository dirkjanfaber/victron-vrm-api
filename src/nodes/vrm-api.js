module.exports = function (RED) {
  'use strict'

  const VRMAPIService = require('../services/vrm-api-service')
  const { buildStatsParameters } = require('../utils/stats-parameters')
  const debug = require('debug')('victron-vrm-api')

  const { transformPriceSchedule } = require('../utils/price-schedule-transformer')

  function VRMAPI (config) {
    RED.nodes.createNode(this, config)
    debug('VRMAPI node created with config:', config)

    this.vrm = RED.nodes.getNode(config.vrm)
    const node = this
    node.lastValidUpdate = null

    const isDynamicESS = config.installations === 'fetch-dynamic-ess-schedules'
    if (isDynamicESS && config.transform_price_schedule) {
      // When transform is enabled, we have 2 outputs
      // This doesn't actually change the node, but documents the intent
    }

    node.on('input', async function (msg) {
      const currentTime = Date.now()

      // Rate limiting
      if (node.lastValidUpdate && (currentTime - node.lastValidUpdate) < 5000) {
        node.status({ fill: 'yellow', shape: 'dot', text: 'Limit queries quickly' })
        return
      }

      // Get API token from config or flow context
      const flowContext = this.context().flow
      const apiToken = this.vrm ? this.vrm.credentials.token : flowContext.get('vrm_api.credentials.token')

      if (!apiToken) {
        node.status({ fill: 'red', shape: 'ring', text: 'No API token configured' })
        return
      }

      // Initialize API service with IPv4 configuration if available
      const serviceOptions = {}
      if (this.vrm && this.vrm.forceIpv4) {
        serviceOptions.forceIpv4 = true
      }

      // Initialize API service
      const apiService = new VRMAPIService(apiToken)

      node.status({ fill: 'yellow', shape: 'ring', text: 'Connecting to VRM API' })

      try {
        let result

        // Handle custom API calls (advanced usage)
        if (msg.query && /^(GET|POST|PATCH)$/i.test(msg.method)) {
          const customUrl = (msg.url || 'https://vrmapi.victronenergy.com/v2') + '/' + msg.query
          result = await apiService.makeCustomCall(customUrl, msg.method, msg.payload)
          msg.topic = msg.topic || 'custom'
        } else {
          // Handle standard API types
          switch (config.api_type) {
            case 'users': {
              // Backwards compatibility: fallback to 'users' field for old flows
              const usersQuery = config.usersQuery || config.users || 'me'
              result = await apiService.callUsersAPI(usersQuery, config.idUser)
              msg.topic = `users ${usersQuery}`
              break
            }

            case 'installations': {
              const siteId = await resolveSiteId(config.idSite, msg, node)
              if (!siteId) return // Error already handled

              // Handle stats endpoint with parameters
              const options = {}
              if (config.installations === 'stats' || config.installations === 'fetch-dynamic-ess-schedules') {
                options.parameters = buildStatsParameters(config)
              }

              result = await apiService.callInstallationsAPI(siteId, config.installations, 'GET', msg.payload, options)
              msg.topic = `installations ${config.installations}`
              break
            }

            case 'widgets': {
              const widgetSiteId = await resolveSiteId(config.idSite, msg, node)
              if (!widgetSiteId) return // Error already handled

              result = await apiService.callWidgetsAPI(widgetSiteId, config.widgets, config.instance)
              msg.topic = `widgets ${config.widgets}`

              break
            }

            default:
              node.status({ fill: 'red', shape: 'ring', text: 'Unknown API type' })
              return
          }
        }

        // Handle the response
        if (result.success) {
          const messages = [null, null]

          // Output 1: Raw data (always sent)
          // Clone the original message to preserve HTTP context and custom properties
          messages[0] = RED.util.cloneMessage(msg)
          messages[0].payload = result.data
          messages[0].topic = msg.topic
          messages[0].url = result.url

          // Store in global context if requested
          if (config.store_in_global_context === true) {
            const globalContext = node.context().global
            globalContext.set(msg.topic.split(' ').join('.'), result.data)
          }

          // Check if we should transform price schedule
          const shouldTransform = config.transform_price_schedule &&
                                  config.installations === 'stats' &&
                                  config.attribute === 'dynamic_ess'

          if (shouldTransform) {
            // Output 2: Transformed price schedule
            try {
              const transformed = transformPriceSchedule(result.data.records || result.data)

              // Clone the original message for output 2 as well
              messages[1] = RED.util.cloneMessage(msg)
              messages[1].payload = transformed.payload
              messages[1].metadata = transformed.metadata
              messages[1].topic = 'price-schedule'

              node.status({
                fill: 'green',
                shape: 'dot',
                text: `${transformed.metadata.count} price intervals`
              })
            } catch (err) {
              node.warn('Failed to transform price schedule: ' + err.message)
              node.status({
                fill: 'yellow',
                shape: 'ring',
                text: 'transform error'
              })
            }
          } else {
            // Set status based on response (existing logic)
            if (result.data && result.data.success === false) {
              node.status({ fill: 'yellow', shape: 'dot', text: result.data.error_code })
            } else {
              let statusInfo = { text: 'Ok', color: 'green' }

              // Use service methods to interpret different response types
              if (config.api_type === 'users' && result.data) {
                // Backwards compatibility: fallback to 'users' field for old flows
                const usersQuery = config.usersQuery || config.users || 'me'
                statusInfo = apiService.interpretUsersStatus(result.data, usersQuery)
              } else if (config.installations === 'stats' && result.data) {
                statusInfo = apiService.interpretStatsStatus(result.data)
              } else if (config.installations === 'dynamic-ess-settings' && result.data) {
                statusInfo = apiService.interpretDynamicEssStatus(result.data)
              } else if (config.api_type === 'widgets' && result.data) {
                statusInfo = apiService.interpretWidgetsStatus(result.data, config.widgets, config.instance)
              }

              node.status({ fill: statusInfo.color, shape: 'dot', text: statusInfo.text })
            }
          }

          node.lastValidUpdate = currentTime
          node.send(messages)
        }

        // Verbose logging
        if (config.verbose === true) {
          node.warn({
            url: result.url,
            method: result.method,
            status: result.status
          })
        }
      } catch (error) {
        node.status({ fill: 'red', shape: 'dot', text: 'Unexpected error' })
        debug('Unexpected error:', error)
        msg.payload = { error: error.message }
        node.send(msg)
      }
    })

    node.on('close', function () {
      // Cleanup if needed
    })
  }

  /**
   * Resolve site ID from config, handling context variables
   */
  async function resolveSiteId (configSiteId, msg, node) {
    // Check if it's a context variable like {{flow.siteId}}
    const match = configSiteId.match(/^\{\{(node|flow|global)\.(.+)\}\}$/)
    if (match) {
      const contextType = match[1]
      const contextKey = match[2]
      const context = node.context()[contextType]
      const resolvedId = context.get(contextKey)

      if (resolvedId !== undefined) {
        return resolvedId.toString()
      } else {
        node.status({ fill: 'red', shape: 'ring', text: `Unable to retrieve ${configSiteId} from context` })
        return null
      }
    }

    // Use direct ID from config or message
    return (msg.siteId || configSiteId).toString()
  }

  RED.nodes.registerType('vrm-api', VRMAPI)

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports.buildStatsParameters = buildStatsParameters
  }
}
