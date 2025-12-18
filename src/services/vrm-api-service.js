'use strict'

const axios = require('axios')
const http = require('http')
const https = require('https')
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
   */
  interpretUsersStatus (responseData, endpoint) {
    if (!responseData) {
      return {
        text: 'No user data found',
        color: 'yellow',
        raw: responseData
      }
    }

    if (endpoint === 'me') {
      const user = responseData.user

      if (!user) {
        return {
          text: 'No user data found',
          color: 'yellow',
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
          color: 'yellow',
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
   * Interpret stats API response for status display
   */
  interpretStatsStatus (responseData) {
    if (!responseData || !responseData.totals) {
      return {
        text: 'No stats data',
        color: 'yellow',
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
   * Interpret dynamic ESS settings response for status display
   */
  interpretDynamicEssStatus (responseData) {
    const data = responseData?.data

    const hasValidMode = data?.mode !== undefined && data?.mode !== null
    const hasValidOperatingMode = data?.operatingMode !== undefined && data?.operatingMode !== null

    if (!hasValidMode || !hasValidOperatingMode) {
      return {
        text: 'No data',
        color: 'yellow',
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
   * Interpret widgets API response for status display
   */
  interpretWidgetsStatus (responseData, widgetType, instance) {
    if (!responseData?.records?.data) {
      return {
        text: 'No widget data',
        color: 'yellow',
        hasData: false,
        raw: responseData
      }
    }

    const data = responseData.records.data

    // Check if we have actual device data (not just metadata)
    const hasActualData = Object.keys(data).some(key =>
      key !== 'hasOldData' && key !== 'secondsAgo' &&
    typeof data[key] === 'object' &&
    data[key].value !== undefined
    )

    if (!hasActualData) {
      return {
        text: 'No data - incorrect instance?',
        color: 'yellow',
        hasData: false,
        instance,
        raw: responseData
      }
    }

    // Widget configuration lookup table
    const widgetConfig = {
      EvChargerSummary: {
        lookupKey: '824',
        lookupCode: 'evs',
        lookupDataAttribute: 'Status',
        fallbackText: 'EV Charger',
        valueProperty: 'evChargerStatus'
      },
      TempSummaryAndGraph: {
        lookupKey: '450',
        lookupCode: 'tsT',
        fallbackText: 'Temperature sensor',
        valueProperty: 'temperatureValue',
        includeInstanceInText: true // Show instance info for temperature
      }
    }

    // Get configuration for this widget type
    const config = widgetConfig[widgetType]

    if (config) {
    // Try different lookup strategies in order of preference
      let targetData = null

      // 1. Try lookup by specific key (e.g., data["450"])
      if (config.lookupKey && data[config.lookupKey]) {
        targetData = data[config.lookupKey]
      }

      // 2. Try lookup by code (e.g., code === 'evs')
      if (!targetData && config.lookupCode) {
        targetData = Object.values(data).find(item => item.code === config.lookupCode)
      }

      // 3. Try lookup by dataAttributeName (e.g., dataAttributeName === 'Status')
      if (!targetData && config.lookupDataAttribute) {
        targetData = Object.values(data).find(item =>
          item.dataAttributeName === config.lookupDataAttribute
        )
      }

      if (targetData && targetData.formattedValue) {
      // Check data validity first - applies to all widgets
        if (targetData.isValid === 0) {
          return {
            text: 'Invalid data',
            color: 'yellow',
            hasData: true,
            hasValidData: false,
            instance,
            raw: responseData
          }
        }

        if (targetData.hasOldData === true) {
          return {
            text: 'Stale data - check sensor',
            color: 'yellow',
            hasData: true,
            hasValidData: false,
            instance,
            raw: responseData
          }
        }

        // Data is valid - format display text based on widget type
        let displayText = targetData.formattedValue

        // Add instance info if configured for this widget type
        if (config.includeInstanceInText && instance) {
          if (widgetType === 'TempSummaryAndGraph') {
            displayText = `Temperature (inst. ${instance}): ${targetData.formattedValue}`
          } else {
            displayText = `${config.fallbackText} (inst. ${instance}): ${targetData.formattedValue}`
          }
        }

        const result = {
          text: displayText,
          color: 'green',
          hasData: true,
          hasValidData: true,
          instance,
          raw: responseData
        }

        // Add widget-specific property
        result[config.valueProperty] = targetData.formattedValue

        return result
      }

      // Has data but no target field found
      let fallbackText = config.fallbackText
      if (config.includeInstanceInText && instance) {
        fallbackText = `${config.fallbackText} (inst. ${instance})`
      }

      return {
        text: fallbackText,
        color: 'green',
        hasData: true,
        [config.valueProperty]: null,
        instance,
        raw: responseData
      }
    }

    // Default for unknown widget types - just show the widget type name
    return {
      text: widgetType,
      color: 'green',
      hasData: true,
      instance,
      raw: responseData
    }
  }
}

module.exports = VRMAPIService
