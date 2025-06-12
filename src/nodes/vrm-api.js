module.exports = function (RED) {
  'use strict'

  const axios = require('axios')
  const curlirize = require('axios-curlirize')
  const path = require('path')
  const packageJson = require(path.join(__dirname, '../../', 'package.json'))
  const debug = require('debug')('victron-vrm-api')


  function VRMAPI (config) {
    RED.nodes.createNode(this, config)
    debug('VRMAPI node created with config:', config)

    this.vrm = RED.nodes.getNode(config.vrm)

    const node = this

    let lastValidUpdate = null

    node.on('input', function (msg) {
      let url = msg.url || 'https://vrmapi.victronenergy.com/v2'
      let installations = config.installations
      let method = 'get'

      const currentTime = Date.now()

      if (lastValidUpdate && (currentTime - lastValidUpdate) < 5000) {
        node.status({ fill: 'yellow', shape: 'dot', text: 'Limit queries quickly' })
        return
      }

      let options = {
      }
      const flowContext = this.context().flow
      const headers = {
        'X-Authorization': 'Token ' + (this.vrm ? this.vrm.credentials.token : flowContext.get('vrm_api.credentials.token')),
        accept: 'application/json',
        'User-Agent': 'nrc-vrm-api/' + packageJson.version
      }

      if (msg.query && /^(GET|POST|PATCH)$/i.test(msg.method)) {
        url += '/' + msg.query
        method = msg.method.toLowerCase()
        msg.topic = msg.topic || 'custom'
      } else {
        const parameters = {}
        const topic = [config.api_type]
        switch (config.api_type) {
          case 'installations': {
            if (config.installations === 'post-alarms') {
              installations = 'alarms'
              method = 'post'
            }
            if (config.installations === 'post-dynamic-ess-settings') {
              installations = 'dynamic-ess-settings'
              method = 'post'
            }
            if (config.installations === 'patch-dynamic-ess-settings') {
              installations = 'dynamic-ess-settings'
              method = 'patch'
            }
            topic.push(installations)
            url += '/' + config.api_type + '/'
            const match = config.idSite.match(/^\{\{(node|flow|global)\.(.*)\}\}$/)
            if (match) {
              const Context = this.context()[match[1]]
              if (Context.get([match[2]])[0] !== undefined) {
                url += Context.get([match[2]]).toString()
                topic.push(Context.get([match[2]]).toString())
              } else {
                node.status({ fill: 'red', shape: 'ring', text: `Unable to retrieve ${config.idSite} from context` })
                return
              }
            } else {
              url += (msg.siteId || config.idSite)
              topic.push((msg.siteId || config.idSite))
            }
            url += '/' + installations

            if (installations === 'stats') {
              parameters.type = 'custom';
              Object.assign(parameters,
                config.attribute !== 'dynamic_ess'
                  ? {
                      'attributeCodes[]': config.attribute,
                      ...(config.stats_interval && { interval: config.stats_interval }),
                      ...(config.show_instance === true && { show_instance: 1 })
                    }
                  : { type: config.attribute }
              );

              if (config.attribute === 'evcs') {
                delete (parameters['attributeCodes[]']);
                parameters.type = 'evcs';
              }

              // --- Start of Corrected Time Logic ---
              const now = new Date();
              const nowTs = Math.floor(now.getTime() / 1000); // Unix timestamp for now, in seconds

              // Helper function to floor a Unix timestamp (in seconds) to the beginning of the hour
              const floorToHour = (ts) => {
                if (ts === undefined || ts === null) return ts;
                return ts - (ts % 3600);
              };

              const getStartOfDay = (date) => {
                const start = new Date(date);
                config.use_utc ? start.setUTCHours(0, 0, 0, 0) : start.setHours(0, 0, 0, 0);
                return Math.floor(start.getTime() / 1000);
              };

              // --- Calculate Start Time ---
              if (config.stats_start && config.stats_start !== 'undefined') {
                const startInput = config.stats_start;
                let calculatedStart;
                if (!isNaN(Number(startInput))) {
                  // Handles numeric offsets like -86400 (from now)
                  calculatedStart = nowTs + Number(startInput);
                } else if (startInput === 'bod') { // Beginning of Today
                  calculatedStart = getStartOfDay(now);
                } else if (startInput === 'boy') { // Beginning of Yesterday
                  calculatedStart = getStartOfDay(now) - 86400;
                } else if (startInput === 'bot') { // Beginning of Tomorrow
                  calculatedStart = getStartOfDay(now) + 86400;
                }
                // Assign the final floored value
                parameters.start = floorToHour(calculatedStart);
              }

              // --- Calculate End Time ---
              if (config.stats_end && config.stats_end !== 'undefined') {
                const endInput = config.stats_end;
                let calculatedEnd;
                if (!isNaN(Number(endInput))) {
                  // Handles numeric offsets like 0 (for now) or +86400 (for tomorrow)
                  calculatedEnd = nowTs + Number(endInput);
                } else if (endInput === 'eod') { // End of Today
                  const endOfDay = new Date(now);
                  config.use_utc ? endOfDay.setUTCHours(23, 59, 59, 999) : endOfDay.setHours(23, 59, 59, 999);
                  calculatedEnd = Math.floor(endOfDay.getTime() / 1000);
                } else if (endInput === 'eoy') { // End of Yesterday
                  calculatedEnd = getStartOfDay(now) - 1; // 23:59:59 of yesterday
                }
                // Assign the final floored value
                parameters.end = floorToHour(calculatedEnd);
              }
              // --- End of Corrected Time Logic ---
            }
            if (installations === 'gps-download') {
              const gpsStart = new Date(config.gps_start + ' GMT+0000')
              const gpsEnd = new Date(config.gps_end + ' GMT+0000')
              parameters.start = Math.floor(gpsStart.getTime() / 1000)
              parameters.end = Math.floor(gpsEnd.getTime() / 1000)
            }
            url += '?' + Object.entries(parameters)
              .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
              .join('&')
          }
            break
          case 'users':
            url += '/' + config.api_type
            if (config.users === 'installations') {
              url += '/' + config.idUser
              topic.push(config.users, config.idUser)
            }
            url += '/' + config.users
            break
          case 'widgets': {
            topic.push(config.widgets)
            url += '/installations/'
            const match = config.idSite.match(/^\{\{(node|flow|global)\.(.*)\}\}$/)
            if (match) {
              const Context = this.context()[match[1]]
              if (Context.get([match[2]])[0] !== undefined) {
                url += Context.get([match[2]]).toString()
                topic.push(Context.get([match[2]]).toString())
              } else {
                node.status({ fill: 'red', shape: 'ring', text: `Unable to retrieve ${config.idSite} from context` })
                return
              }
            } else {
              url += (msg.siteId || config.idSite) + '/'
              topic.push((msg.siteId || config.idSite))
            }
            url += config.api_type + '/' + config.widgets

            // instance
            if (config.instance) {
              parameters.instance = config.instance
            }
            url += '?' + Object.entries(parameters)
              .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
              .join('&')
          }
            break

          case 'dynamic-ess':
            topic.push('dynamic-ess')
            url = 'https://vrm-dynamic-ess-api.victronenergy.com'
            options = {
              vrm_id: (config.vrm_id).toString(),
              b_max: (config.b_max).toString(),
              tb_max: (config.tb_max).toString(),
              fb_max: (config.fb_max).toString(),
              tg_max: (config.tg_max).toString(),
              fg_max: (config.fg_max).toString(),
              b_cycle_cost: (config.b_cycle_cost).toString(),
              buy_price_formula: (config.buy_price_formula).toString(),
              sell_price_formula: (config.sell_price_formula).toString(),
              green_mode_on: (config.green_mode_on || false).toString(),
              feed_in_possible: (config.feed_in_possible || false).toString(),
              feed_in_control_on: (config.feed_in_control_on || false).toString(),
              country: (config.country).toUpperCase(),
              b_goal_hour: (config.b_goal_hour).toString(),
              b_goal_SOC: (config.b_goal_SOC).toString()
            }
            headers['User-Agent'] = 'dynamic-ess/0.1.20'
            break
        }
        msg.topic = topic.join(' ')
      }

      url = url.replace(/&$/, '')

      if (config.verbose === true) {
        node.warn({
          url,
          options,
          headers
        })
      }

      node.status({ fill: 'yellow', shape: 'ring', text: 'Connecting to VRM API' })

      switch (method) {
        case 'patch':
          axios.patch(url, msg.payload, { headers }).then(function (response) {
            if (response.status === 200) {
              msg.payload = response.data
              msg.payload.options = options

              if (msg.payload.success === false) {
                node.status({ fill: 'yellow', shape: 'dot', text: msg.payload.error_code })
              } else {
                node.status({ fill: 'green', shape: 'dot', text: 'Ok' })
              }
            } else {
              node.status({ fill: 'yellow', shape: 'dot', text: response.status })
            }

            if (config.store_in_global_context === true) {
              const globalContext = node.context().global
              globalContext.set(msg.topic.split(' ').join('.'), response.data)
            }

            node.send(msg)
          }).catch(function (error) {
            if (error.response && error.response.data && error.response.data.errors) {
              node.status({ fill: 'red', shape: 'dot', text: error.response.data.errors })
            } else {
              node.status({ fill: 'red', shape: 'dot', text: 'Error fetching VRM data' })
            }

            if (error.response) {
              node.send({ payload: error.response })
            }
          })
          break
        case 'post':
          axios.post(url, msg.payload, { headers }).then(function (response) {
            if (response.status === 200) {
              msg.payload = response.data
              msg.payload.options = options

              if (msg.payload.success === false) {
                node.status({ fill: 'yellow', shape: 'dot', text: msg.payload.error_code })
              } else {
                node.status({ fill: 'green', shape: 'dot', text: 'Ok' })
              }
            } else {
              node.status({ fill: 'yellow', shape: 'dot', text: response.status })
            }

            if (config.store_in_global_context === true) {
              const globalContext = node.context().global
              globalContext.set(msg.topic.split(' ').join('.'), response.data)
            }

            node.send(msg)
          }).catch(function (error) {
            if (error.response && error.response.data && error.response.data.errors) {
              node.status({ fill: 'red', shape: 'dot', text: error.response.data.errors })
            } else {
              node.status({ fill: 'red', shape: 'dot', text: 'Error fetching VRM data' })
            }

            if (error.response) {
              node.send({ payload: error.response })
            }
          })
          break
        default: // get
          axios.get(url, { params: options, headers }).then(function (response) {
            if (response.status === 200) {
              let text = 'Ok'
              msg.payload = response.data
              if (installations !== 'gps-download') {
                msg.payload.options = options
              }
              if (response.data.totals) {
                const key = Object.keys(response.data.totals)[0]
                const isNumber = value => !isNaN(value) && typeof value === 'number'
                const formatNumber = value => isNumber(value) ? value.toFixed(1) : value
                text = `${key.replace(/_/g, ' ')}: ${formatNumber(response.data.totals[key])}`
              }
              node.status({ fill: 'green', shape: 'dot', text })
            } else {
              node.status({ fill: 'yellow', shape: 'dot', text: response.status })
            }

            if (config.store_in_global_context === true) {
              const globalContext = node.context().global
              globalContext.set(msg.topic.split(' ').join('.'), response.data)
            }

            lastValidUpdate = currentTime

            node.send(msg)
          }).catch(function (error) {
            if (error.response && error.response.data && error.response.data.errors) {
              node.status({ fill: 'red', shape: 'dot', text: error.response.data.errors })
            } else {
              node.status({ fill: 'red', shape: 'dot', text: 'Error fetching VRM data' })
            }
            if (error.response) {
              node.send({ payload: error.response })
            }
          })
      }
    })

    node.on('close', function () {
    })

    if (config.verbose === true) {
      curlirize(axios)
    }
  }

  RED.nodes.registerType('vrm-api', VRMAPI)
}
