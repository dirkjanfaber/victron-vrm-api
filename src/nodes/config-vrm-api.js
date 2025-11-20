module.exports = function (RED) {
  'use strict'
  function ConfigVRMAPI (config) {
    RED.nodes.createNode(this, config)
    this.name = config.name
    this.forceIpv4 = config.forceIpv4 || false

    // Transfer data from previous versions
    if (this.credentials && !this.credentials.token && config.token) {
      RED.nodes.addCredentials(this.id, { token: config.token })
    }

    // Delete deprecated properties
    delete config.token
    delete this.token
  }
  RED.nodes.registerType('config-vrm-api', ConfigVRMAPI, {
    credentials: {
      token: {
        type: 'password'
      }
    }
  })
}
