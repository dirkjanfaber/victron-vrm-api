'use strict'

const axios = require('axios')
const debug = require('debug')('victron-vrm-api:service')
const path = require('path')

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
    } else if (endpoint === 'post-dynamic-ess-settings') {
      actualEndpoint = 'dynamic-ess-settings'
      actualMethod = 'post'
    } else if (endpoint === 'patch-dynamic-ess-settings') {
      actualEndpoint = 'dynamic-ess-settings'
      actualMethod = 'patch'
    }

    url += `/${actualEndpoint}`

    // Add query parameters for stats endpoint
    if (actualEndpoint === 'stats' && options.parameters) {
      const params = new URLSearchParams()
      Object.entries(options.parameters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v))
        } else {
          params.append(key, value)
        }
      })
      const queryString = params.toString()
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
  async callWidgetsAPI (siteId, widgetType, instance = null) {
    let url = `${this.baseUrl}/installations/${siteId}/widgets/${widgetType}`

    if (instance) {
      url += `?instance=${instance}`
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
   * Handle Dynamic ESS API calls (different base URL)
   */
  async callDynamicEssAPI (options = {}) {
    const url = this.dynamicEssUrl

    // Convert all options to strings as per original node logic
    const payload = {
      vrm_id: (options.vrm_id || '').toString(),
      b_max: (options.b_max || '').toString(),
      tb_max: (options.tb_max || '').toString(),
      fb_max: (options.fb_max || '').toString(),
      tg_max: (options.tg_max || '').toString(),
      fg_max: (options.fg_max || '').toString(),
      b_cycle_cost: (options.b_cycle_cost || '').toString(),
      buy_price_formula: (options.buy_price_formula || '').toString(),
      sell_price_formula: (options.sell_price_formula || '').toString(),
      green_mode_on: (options.green_mode_on || false).toString(),
      feed_in_possible: (options.feed_in_possible || false).toString(),
      feed_in_control_on: (options.feed_in_control_on || false).toString(),
      country: (options.country || '').toUpperCase(),
      b_goal_hour: (options.b_goal_hour || '').toString(),
      b_goal_SOC: (options.b_goal_SOC || '').toString()
    }

    const headers = this._buildHeaders({
      'User-Agent': 'dynamic-ess/0.1.20'
    })

    debug(`POST ${url}`, payload)

    try {
      const response = await axios.post(url, payload, { headers })
      debug(`Response ${response.status}:`, response.data)

      return {
        success: true,
        status: response.status,
        data: response.data,
        url,
        method: 'post'
      }
    } catch (error) {
      debug('API Error:', error.response?.status, error.response?.data)
      return {
        success: false,
        status: error.response?.status,
        data: error.response?.data,
        error: error.message,
        url,
        method: 'post'
      }
    }
  }

  /**
   * Helper method to extract user data from VRM API response
   * Handles the nested structure where user data is in response.user
   */
  extractUserData (apiResponse) {
    if (!apiResponse || !apiResponse.user) {
      return null
    }

    return {
      id: apiResponse.user.id,
      email: apiResponse.user.email,
      name: apiResponse.user.name,
      country: apiResponse.user.country,
      accessLevel: apiResponse.user.accessLevel,
      idAccessToken: apiResponse.user.idAccessToken,
      raw: apiResponse
    }
  }

  /**
   * Interpret users API response for status display
   * Returns formatted status information for users data
   */
  interpretUsersStatus (responseData, endpoint) {
    if (!responseData) {
      return {
        text: 'No user data found',
        color: 'orange',
        raw: responseData
      }
    }

    if (endpoint === 'me') {
      const user = responseData.user

      if (!user) {
        return {
          text: 'No user data found',
          color: 'orange',
          raw: responseData
        }
      }

      const text = `${user.name} (ID: ${user.id})`

      return {
        text,
        color: 'green',
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userCountry: user.country,
        accessLevel: user.accessLevel,
        raw: responseData
      }
    }

    if (endpoint === 'installations') {
      const records = responseData.records

      if (!Array.isArray(records)) {
        return {
          text: 'No installations data found',
          color: 'orange',
          raw: responseData
        }
      }

      const count = records.length
      const text = `${count} installation${count === 1 ? '' : 's'}`

      return {
        text,
        color: 'green',
        installationCount: count,
        raw: responseData
      }
    }

    // Default for other users endpoints
    return {
      text: 'Users data received',
      color: 'green',
      raw: responseData
    }
  }

  /**
   * Interpret Dynamic ESS settings response for status display
   * Returns structured status information that can be used by any consumer
   *
   * Dynamic ESS API returns data in this structure:
   * {
   *   "success": true,
   *   "data": {
   *     "idSite": 102195,
   *     "isGreenModeOn": true,
   *     "mode": 1,
   *     "operatingMode": 1,
   *     // ... many other fields
   *   }
   * }
   */
  interpretDynamicEssStatus (responseData) {
    const data = responseData?.data

    const hasValidMode = data?.mode !== undefined && data?.mode !== null
    const hasValidOperatingMode = data?.operatingMode !== undefined && data?.operatingMode !== null

    if (!hasValidMode || !hasValidOperatingMode) {
      return {
        text: 'No data',
        color: 'orange',
        mode: null,
        operatingMode: null,
        raw: responseData
      }
    }

    const modeNames = {
      0: 'Off',
      1: 'Auto',
      2: 'Buy (deprecated)',
      3: 'Sell (deprecated)',
      4: 'Local'
    }

    const operationModeNames = ['Trade', 'Green']

    const currentMode = data.mode
    const currentOpMode = data.operatingMode

    const text = `${modeNames[currentMode] || 'Unknown'} - ${operationModeNames[currentOpMode] || 'Unknown'} mode`
    const color = currentMode === 0 ? 'blue' : 'green'

    return {
      text,
      color,
      mode: currentMode,
      operatingMode: currentOpMode,
      modeName: modeNames[currentMode],
      operatingModeName: operationModeNames[currentOpMode],
      isGreenModeOn: data.isGreenModeOn,
      raw: responseData
    }
  }

  /**
   * Interpret stats response for status display
   * Returns formatted status information for stats data
   */
  interpretStatsStatus (responseData) {
    if (!responseData || !responseData.totals) {
      return {
        text: 'No stats data',
        color: 'orange',
        totals: null,
        raw: responseData
      }
    }

    const key = Object.keys(responseData.totals)[0]
    if (!key) {
      return {
        text: 'No totals',
        color: 'yellow',
        totals: responseData.totals,
        raw: responseData
      }
    }

    const value = responseData.totals[key]
    const formatNumber = (value) => typeof value === 'number' ? value.toFixed(1) : value
    const text = `${key.replace(/_/g, ' ')}: ${formatNumber(value)}`

    return {
      text,
      color: 'green',
      key,
      value,
      formattedValue: formatNumber(value),
      totals: responseData.totals,
      raw: responseData
    }
  }

  /**
   * Generic method to make custom API calls (for advanced usage)
   */
  async makeCustomCall (url, method = 'GET', payload = null, customHeaders = {}) {
    const headers = this._buildHeaders(customHeaders)

    debug(`${method.toUpperCase()} ${url}`, payload ? { payload } : '')

    try {
      let response
      switch (method.toLowerCase()) {
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
          throw new Error(`Unsupported method: ${method}`)
      }

      debug(`Response ${response.status}:`, response.data)
      return {
        success: true,
        status: response.status,
        data: response.data,
        url,
        method: method.toLowerCase()
      }
    } catch (error) {
      debug('API Error:', error.response?.status, error.response?.data)
      return {
        success: false,
        status: error.response?.status,
        data: error.response?.data,
        error: error.message,
        url,
        method: method.toLowerCase()
      }
    }
  }
}

module.exports = VRMAPIService
