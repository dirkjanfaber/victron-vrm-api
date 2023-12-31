module.exports = function (RED) {
  'use strict'

  const axios = require('axios')
  const curlirize = require('axios-curlirize')
  const path = require('path')
  const packageJson = require(path.join(__dirname, '../../', 'package.json'))

  function VRMAPI (config) {
    RED.nodes.createNode(this, config)

    this.vrm = RED.nodes.getNode(config.vrm)

    const node = this

    node.lastValidUpdate = Date.now()

    node.on('input', function (msg) {
      let url = msg.url || 'https://vrmapi.victronenergy.com/v2'
      let installations = config.installations
      let method = 'get'

      let options = {
      }
      const headers = {
        'X-Authorization': 'Token ' + this.vrm.credentials.token,
        accept: 'application/json',
        'User-Agent': 'nrc-vrm-api/' + packageJson.version
      }

      if (config.installations === 'post-alarms') {
        installations = 'alarms'
        method = 'post'
      }

      if (config.installations === 'dess') {
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
          feed_in_possible: (config.feed_in_possible).toString(),
          feed_in_control_on: (config.feed_in_control_on).toString(),
          country: (config.country).toUpperCase()
        }
        headers['User-Agent'] = 'dynamic-ess/0.1.10'
      } else {
        url += '/installations/' + config.idSite + '/' + installations

        if (installations === 'stats') {
          const d = new Date()
          url += '?type=custom&attributeCodes[]=' + config.attribute
          if (config.stats_interval) {
            url += '&interval=' + config.stats_interval
          }
          if (config.show_instance === true) {
            url += '&show_instance=1'
          }
          if (config.stats_start !== 'undefined') {
            let start = config.stats_start
            let dayStart = new Date().setHours(0, 0, 0, 0)
            if (config.use_utc === true) {
              dayStart = new Date().setUTCHours(0, 0, 0, 0)
            }
            if (start === 'boy') {
              start = (dayStart - Date.now() - 86400000) / 1000
            } else if (start === 'bod') {
              start = (dayStart - Date.now()) / 1000
            }
            url += '&start=' + Math.floor((d.getTime() / 1000) + Number(start))
          }
          if (config.stats_end !== 'undefined') {
            let end = config.stats_end
            let dayEnd = new Date().setHours(23, 59, 59, 0)
            if (config.use_utc === true) {
              dayEnd = new Date().setUTCHours(23, 59, 59, 0)
            }
            if (end === 'eoy') {
              end = (dayEnd - Date.now() - 86400000) / 1000
            } else if (end === 'eod') {
              end = (dayEnd - Date.now()) / 1000
            }
            url += '&end=' + Math.floor((d.getTime() / 1000) + Number(end))
          }
        }
      }

      if (config.verbose === true) {
        node.warn({
          url,
          options,
          headers
        })
      }

      node.status({ fill: 'yellow', shape: 'ring', text: 'Connecting to VRM API' })

      msg.topic = config.idSite + ': ' + config.installations

      switch (method) {
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
              globalContext.set(`${config.idSite}_${config.installations}`, response.data)
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
              msg.payload = response.data
              msg.payload.options = options
              node.status({ fill: 'green', shape: 'dot', text: 'Ok' })
            } else {
              node.status({ fill: 'yellow', shape: 'dot', text: response.status })
            }

            if (config.store_in_global_context === true) {
              const globalContext = node.context().global
              globalContext.set(`vrm_api.${config.idSite}_${config.installations}`, response.data)
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
