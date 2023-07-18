module.exports = function (RED) {
  'use strict'
  function ConfigVRMAPI (n) {
    RED.nodes.createNode(this, n)
    this.name = n.name
    this.token = n.token
  }
  RED.nodes.registerType('config-vrm-api', ConfigVRMAPI)
}
