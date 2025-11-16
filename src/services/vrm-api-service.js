'use strict'

const axios = require('axios')
const http = require('http')
const https = require('https')
const debug = require('debug')('victron-vrm-api:service')
const path = require('path')
const { buildStatsParameters } = require('../utils/stats-parameters')

// Get package version for User-Agent
const packageJson = require(path.join(__dirname, '../../', 'package.json'))

/**
 * VRM API Service - Extracted logic from Node-RED node for testability
 */
class VRMAPIService {
  constructor (apiToken, options = {}) {
    this.apiToken = apiToken
    this.baseUrl = options.baseUrl || 'https://vrmapi.victronenergy.com/v2'
    this.dynamicEssUrl = options.dynamicEssUrl || 'https://vrm-dynamic-ess-api.victronenergy.com'
    this.userAgent = options.userAgent || `nrc-vrm-api/${packageJson.version}`
    this.forceIpv4 = options.forceIpv4 || false

    // Configure axios to force IPv4 if requested
    if (this.forceIpv4) {
      debug('Configuring axios to force IPv4 connections')
      axios.defaults.httpAgent = new http.Agent({ family: 4 })
      axios.defaults.httpsAgent = new https.Agent({ family: 4 })
    }
  }

  /**
   * Build standard headers for VRM API requests
   */
  _buildHeaders (additionalHeaders = {}) {
    return {
      'X-Authorization': `Token ${this.apiToken}`,
      accept: 'application/json',
      'User-Agent': this.userAgent,
      ...additionalHeaders
    }
  }

  /**
   * Handle installations API calls
   */
  async callInstallationsAPI (siteId, endpoint, method = 'GET', payload = null, options = {}) {
    let url = `${this.baseUrl}/installations/${siteId}`
    let actualMethod = method.toLowerCase()
    let actualEndpoint = endpoint

    // Handle special endpoint transformations
    if (endpoint === 'post-alarms') {
      actualEndpoint = 'alarms'
      actualMethod = 'post'
    } else if (endpoint === 'patch-dynamic-ess-settings') {
      actualEndpoint = 'dynamic-ess-settings'
      actualMethod = 'patch'
    } else if (endpoint === 'fetch-dynamic-ess-schedules') {
      // NEW: Use the correct schedule-dynamic-ess endpoint
      actualEndpoint = 'schedule-dynamic-ess'
      actualMethod = 'get'
      // This endpoint doesn't need the complex stats parameters
      // It just needs async=0
      options.parameters = { async: 0 }
    }

    url += `/${actualEndpoint}`

    // Add query parameters based on endpoint type
    let queryParams = null

    if (actualEndpoint === 'stats' && options.parameters) {
      // Handle stats endpoint parameters
      queryParams = new URLSearchParams()
      Object.entries(options.parameters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v))
        } else {
          queryParams.append(key, value)
        }
      })
    } else if (actualEndpoint === 'schedule-dynamic-ess' && options.parameters) {
      // Handle schedule-dynamic-ess endpoint parameters
      queryParams = new URLSearchParams()
      Object.entries(options.parameters).forEach(([key, value]) => {
        queryParams.append(key, value)
      })
    }

    if (queryParams) {
      const queryString = queryParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    const headers = this._buildHeaders()

    debug(`${actualMethod.toUpperCase()} ${url}`, payload ? { payload } : '')

    try {
      let response
      switch (actualMethod) {
        case 'get':
          response = await axios.get(url, { headers })
          break
        case 'post':
          response = await axios.post(url, payload, { headers })
          break
        case 'patch':
          response = await axios.patch(url, payload, { headers })
          break
        default:
          throw new Error(`Unsupported method: ${actualMethod}`)
      }

      debug(`Response ${response.status}:`, response.data)
      return {
        success: true,
        status: response.status,
        data: response.data,
        url,
        method: actualMethod
      }
    } catch (error) {
      debug('API Error:', error.response?.status, error.response?.data)
      return {
        success: false,
        status: error.response?.status,
        data: error.response?.data,
        error: error.message,
        url,
        method: actualMethod
      }
    }
  }

  /**
   * Handle users API calls
   *
   * Note: VRM API returns user data in this structure:
   * {
   *   "success": true,
   *   "user": {
   *     "id": 123456,
   *     "name": "User Name",
   *     "email": "user@example.com",
   *     "country": "Country",
   *     "idAccessToken": 1234,
   *     "accessLevel": 1
   *   }
   * }
   */
  async callUsersAPI (endpoint, userId = null) {
    let url = `${this.baseUrl}/users`

    if (endpoint === 'installations') {
      if (userId) {
        url += `/${userId}/installations`
      } else {
        url += '/me/installations'
      }
    } else if (endpoint === 'me') {
      url += '/me'
    } else {
      throw new Error(`Unknown users endpoint: ${endpoint}`)
    }

    const headers = this._buildHeaders()

    debug(`GET ${url}`)

    try {
      const response = await axios.get(url, { headers })

      debug(`Response ${response.status}:`, response.data)

      return {
        success: true,
        status: response.status,
        data: response.data,
        url,
        method: 'get'
      }
    } catch (error) {
      debug('API Error:', error.response?.status, error.response?.data)
      return {
        success: false,
        status: error.response?.status,
        data: error.response?.data,
        error: error.message,
        url,
        method: 'get'
      }
    }
  }

  /**
   * Handle widgets API calls
   */
  async callWidgetsAPI (siteId, widgetType, instance = 0) {
    const url = `${this.baseUrl}/installations/${siteId}/widgets/${widgetType}?instance=${instance}`

    const headers = this._buildHeaders()

    debug(`GET ${url}`)

    try {
      const response = await axios.get(url, { headers })

      debug(`Response ${response.status}:`, response.data)

      return {
        success: true,
        status: response.status,
        data: response.data,
        url,
        method: 'get'
      }
    } catch (error) {
      debug('API Error:', error.response?.status, error.response?.data)
      return {
        success: false,
        status: error.response?.status,
        data: error.response?.data,
        error: error.message,
        url,
        method: 'get'
      }
    }
  }

  /**
   * Interpret users API response for status display
   */
  interpretUsersStatus (data, endpoint) {
    if (endpoint === 'me' && data && data.user) {
      return {
        text: `User: ${data.user.name || data.user.email}`,
        color: 'green'
      }
    }

    if (endpoint === 'installations' && data && data.records) {
      return {
        text: `${data.records.length} installation${data.records.length !== 1 ? 's' : ''}`,
        color: 'green'
      }
    }

    return { text: 'Ok', color: 'green' }
  }

  /**
   * Interpret stats API response for status display
   */
  interpretStatsStatus (data) {
    if (!data || !data.records) {
      return { text: 'No data', color: 'yellow' }
    }

    const recordCount = Object.keys(data.records).length

    if (recordCount === 0) {
      return { text: 'No records', color: 'yellow' }
    }

    return {
      text: `${recordCount} record${recordCount !== 1 ? 's' : ''}`,
      color: 'green'
    }
  }

  /**
   * Interpret dynamic ESS settings response for status display
   */
  interpretDynamicEssStatus (data) {
    if (!data || !data.data) {
      return {
        text: 'Unknown status',
        color: 'blue',
        mode: null,
        modeName: 'Unknown',
        operatingMode: null,
        operatingModeName: 'Unknown'
      }
    }

    const mode = data.data.mode
    const operatingMode = data.data.operatingMode

    const modeNames = {
      0: 'Off',
      1: 'Auto',
      2: 'Buy (deprecated)',
      3: 'Sell (deprecated)',
      4: 'Local'
    }

    const operatingModeNames = {
      0: 'Trade',
      1: 'Green'
    }

    const modeName = modeNames[mode] || 'Unknown'
    const operatingModeName = operatingModeNames[operatingMode] || 'Unknown'
    const statusText = `${modeName} - ${operatingModeName} mode`
    const statusColor = mode === 0 ? 'blue' : 'green'

    return {
      text: statusText,
      color: statusColor,
      mode,
      modeName,
      operatingMode,
      operatingModeName
    }
  }

  /**
   * Interpret widgets API response for status display
   */
  interpretWidgetsStatus (data, widgetType) {
    if (!data || typeof data !== 'object') {
      return { text: 'No data', color: 'yellow' }
    }

    return {
      text: `${widgetType} data`,
      color: 'green'
    }
  }

  /**
   * Make a custom API call to any VRM API endpoint
   */
  async makeCustomCall (url, method = 'GET', payload = null, customHeaders = {}) {
    const headers = this._buildHeaders(customHeaders)
    const actualMethod = method.toLowerCase()

    debug(`${actualMethod.toUpperCase()} ${url}`, payload ? { payload } : '')

    try {
      let response
      switch (actualMethod) {
        case 'get':
          response = await axios.get(url, { headers })
          break
        case 'post':
          response = await axios.post(url, payload, { headers })
          break
        case 'patch':
          response = await axios.patch(url, payload, { headers })
          break
        case 'put':
          response = await axios.put(url, payload, { headers })
          break
        case 'delete':
          response = await axios.delete(url, { headers })
          break
        default:
          throw new Error(`Unsupported method: ${actualMethod}`)
      }

      debug(`Response ${response.status}:`, response.data)
      return {
        success: true,
        status: response.status,
        data: response.data,
        url,
        method: actualMethod
      }
    } catch (error) {
      debug('API Error:', error.response?.status, error.response?.data)
      return {
        success: false,
        status: error.response?.status,
        data: error.response?.data,
        error: error.message,
        url,
        method: actualMethod
      }
    }
  }
}

module.exports = VRMAPIService
