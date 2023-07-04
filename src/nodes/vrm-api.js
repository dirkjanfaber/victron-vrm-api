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
      var url = msg.url || 'https://vrmapi.victronenergy.com/v2'
      var installations = config.installations
      var method = 'get'

      const options = {
      }
      const headers = {
        'X-Authorization': 'Token ' + this.vrm.token,
        accept: 'application/json',
        'User-Agent': 'nrc-vrm-api/' + packageJson.version
      }

      if (config.installations === 'post-alarms') {
        installations = 'alarms'
        method = 'post'
      }

      url += '/installations/' + config.idSite + '/' + installations;

      if ( installations === 'stats' ) {
        url += '?type=custom&attributeCodes[]=' + config.attribute
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
                node.status({ fill: 'yellow', shape: 'dot', text: msg.payload.error_code})
              } else {
                node.status({ fill: 'green', shape: 'dot', text: 'Ok' })
              }
            } else {
              node.status({ fill: 'yellow', shape: 'dot', text: response.status })
            }
    
            node.lastValidUpdate = Date.now()
    
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
          break;
        default: // get
          axios.get(url, { params: options, headers }).then(function (response) {
            if (response.status === 200) {
              msg.payload = response.data
              msg.payload.options = options
              node.status({ fill: 'green', shape: 'dot', text: 'Ok' })
            } else {
              node.status({ fill: 'yellow', shape: 'dot', text: response.status })
            }
    
            node.lastValidUpdate = Date.now()
    
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
