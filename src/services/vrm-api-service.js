'use strict'

const dns = require('dns')
const debug = require('debug')('victron-vrm-api:service')
const path = require('path')

const packageJson = require(path.join(__dirname, '../../', 'package.json'))

class VRMAPIService {
  constructor (apiToken, options = {}) {
    this.apiToken = apiToken
    this.baseUrl = options.baseUrl || 'https://vrmapi.victronenergy.com/v2'
    this.dynamicEssUrl = options.dynamicEssUrl || 'https://vrm-dynamic-ess-api.victronenergy.com'
    this.userAgent = options.userAgent || `nrc-vrm-api/${packageJson.version}`
    this.forceIpv4 = options.forceIpv4 || false

    if (this.forceIpv4) {
      debug('Configuring DNS to prefer IPv4 connections')
      dns.setDefaultResultOrder('ipv4first')
    }
  }

  _buildHeaders (additionalHeaders = {}) {
    return {
      'X-Authorization': `Token ${this.apiToken}`,
      accept: 'application/json',
      'User-Agent': this.userAgent,
      ...additionalHeaders
    }
  }

  async _request (url, method, payload, headers) {
    const options = { method: method.toUpperCase(), headers }

    if (payload !== null && payload !== undefined && (method === 'post' || method === 'patch')) {
      options.body = JSON.stringify(payload)
      options.headers = { ...headers, 'Content-Type': 'application/json' }
    }

    debug(`${method.toUpperCase()} ${url}`, payload ? { payload } : '')

    try {
      const response = await fetch(url, options)
      const data = await response.json()

      debug(`Response ${response.status}:`, data)

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          data,
          error: `HTTP ${response.status}`,
          url,
          method
        }
      }

      return {
        success: true,
        status: response.status,
        data,
        url,
        method
      }
    } catch (error) {
      debug('Request error:', error.message)
      return {
        success: false,
        status: undefined,
        data: undefined,
        error: error.message,
        url,
        method
      }
    }
  }

  async callInstallationsAPI (siteId, endpoint, method = 'GET', payload = null, options = {}) {
    let url = `${this.baseUrl}/installations/${siteId}`
    let actualMethod = method.toLowerCase()
    let actualEndpoint = endpoint

    if (endpoint === 'post-alarms') {
      actualEndpoint = 'alarms'
      actualMethod = 'post'
    } else if (endpoint === 'patch-dynamic-ess-settings') {
      actualEndpoint = 'dynamic-ess-settings'
      actualMethod = 'patch'
    } else if (endpoint === 'post-adjust-consumption') {
      actualEndpoint = 'adjust-consumption'
      actualMethod = 'post'
    } else if (endpoint === 'fetch-dynamic-ess-schedules') {
      actualEndpoint = 'schedule-dynamic-ess'
      actualMethod = 'get'
      options.parameters = { async: 0 }
    }

    url += `/${actualEndpoint}`

    let queryParams = null

    if (actualEndpoint === 'stats' && options.parameters) {
      queryParams = new URLSearchParams()
      Object.entries(options.parameters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v))
        } else {
          queryParams.append(key, value)
        }
      })
    } else if (actualEndpoint === 'schedule-dynamic-ess' && options.parameters) {
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
    return this._request(url, actualMethod, payload, headers)
  }

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
    return this._request(url, 'get', null, headers)
  }

  async callWidgetsAPI (siteId, widgetType, instance = null) {
    let url = `${this.baseUrl}/installations/${siteId}/widgets/${widgetType}`

    if (instance) {
      url += `?instance=${instance}`
    }

    const headers = this._buildHeaders()
    return this._request(url, 'get', null, headers)
  }

  async makeCustomCall (url, method = 'GET', payload = null, customHeaders = {}) {
    const headers = this._buildHeaders(customHeaders)
    return this._request(url, method.toLowerCase(), payload, headers)
  }

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

    return {
      text: 'Users data received',
      color: 'green',
      raw: responseData
    }
  }

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

    const attributeLabels = {
      dhE: 'Heating',
      evE: 'EV charging',
      daE: 'AC load'
    }
    const label = attributeLabels[key] || key.replace(/_/g, ' ')
    const text = `${label}: ${formatNumber(value)}`

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
        includeInstanceInText: true
      }
    }

    const config = widgetConfig[widgetType]

    if (config) {
      let targetData = null

      if (config.lookupKey && data[config.lookupKey]) {
        targetData = data[config.lookupKey]
      }

      if (!targetData && config.lookupCode) {
        targetData = Object.values(data).find(item => item.code === config.lookupCode)
      }

      if (!targetData && config.lookupDataAttribute) {
        targetData = Object.values(data).find(item =>
          item.dataAttributeName === config.lookupDataAttribute
        )
      }

      if (targetData && targetData.formattedValue) {
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

        let displayText = targetData.formattedValue

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

        result[config.valueProperty] = targetData.formattedValue

        return result
      }

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
