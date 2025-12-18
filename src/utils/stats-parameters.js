'use strict'

/**
 * Build parameters for stats endpoint
 */
function buildStatsParameters (config) {
  const parameters = {}

  if (config.attribute !== 'dynamic_ess') {
    parameters.type = 'custom'
    parameters['attributeCodes[]'] = config.attribute

    if (config.show_instance === true) {
      parameters.show_instance = 1
    }
  } else {
    parameters.type = config.attribute
    // Default interval for dynamic_ess
    if (!config.stats_interval && !config.interval) {
      parameters.interval = 'hours'
    }
  }

  // Add interval for all types (including dynamic_ess)
  if (config.stats_interval || config.interval) {
    parameters.interval = config.stats_interval || config.interval
  }

  if (config.attribute === 'evcs') {
    delete parameters['attributeCodes[]']
    parameters.type = 'evcs'
  }

  // Handle time parameters
  const now = new Date()
  const nowTs = Math.floor(now.getTime() / 1000)

  // Helper function to floor to hour
  const floorToHour = (ts) => {
    if (ts === undefined || ts === null) return ts
    return ts - (ts % 3600)
  }

  const getStartOfDay = (date) => {
    const start = new Date(date)
    if (config.use_utc) {
      start.setUTCHours(0, 0, 0, 0)
    } else {
      start.setHours(0, 0, 0, 0)
    }
    return Math.floor(start.getTime() / 1000)
  }

  // Set start time
  if (config.stats_start) { // interpret 'now', 'boy' 'bod' and 'bot'
    if (config.stats_start === 'now') {
      parameters.start = floorToHour(nowTs)
    } else if (config.stats_start === 'boy') {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      parameters.start = getStartOfDay(yesterday)
    } else if (config.stats_start === 'bod') {
      parameters.start = getStartOfDay(now)
    } else if (config.stats_start === 'bot') {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      parameters.start = getStartOfDay(tomorrow)
    } else if (!isNaN(parseInt(config.stats_start))) {
      // the value is an offset in seconds from now
      parameters.start = floorToHour(nowTs + parseInt(config.stats_start))
    }
  }

  // Set end time
  if (config.stats_end) { // interpret 'eod', 'eoy', 'eot', and 'eoyr'
    if (config.stats_end === 'eod') {
      const endOfDay = new Date(now)
      // Set to start of next day (24:00:00 = 00:00:00 + 1 day) for API preference
      endOfDay.setDate(endOfDay.getDate() + 1)
      if (config.use_utc) {
        endOfDay.setUTCHours(0, 0, 0, 0)
      } else {
        endOfDay.setHours(0, 0, 0, 0)
      }
      parameters.end = Math.floor(endOfDay.getTime() / 1000)
    } else if (config.stats_end === 'eoy') {
      const endOfYesterday = new Date(now)
      endOfYesterday.setDate(endOfYesterday.getDate() - 1)
      if (config.use_utc) {
        endOfYesterday.setUTCHours(23, 59, 59, 999)
      } else {
        endOfYesterday.setHours(23, 59, 59, 999)
      }
      parameters.end = Math.floor(endOfYesterday.getTime() / 1000)
    } else if (config.stats_end === 'eot') {
      // End of tomorrow
      const endOfTomorrow = new Date(now)
      endOfTomorrow.setDate(endOfTomorrow.getDate() + 1)
      if (config.use_utc) {
        endOfTomorrow.setUTCHours(23, 59, 59, 999)
      } else {
        endOfTomorrow.setHours(23, 59, 59, 999)
      }
      parameters.end = Math.floor(endOfTomorrow.getTime() / 1000)
    } else if (config.stats_end === 'eoyr') {
      const endOfYear = new Date(now)
      if (config.use_utc) {
        endOfYear.setUTCFullYear(now.getUTCFullYear(), 11, 31)
        endOfYear.setUTCHours(23, 59, 59, 999)
      } else {
        endOfYear.setFullYear(now.getFullYear(), 11, 31)
        endOfYear.setHours(23, 59, 59, 999)
      }
      parameters.end = Math.floor(endOfYear.getTime() / 1000)
    } else if (!isNaN(parseInt(config.stats_end))) {
      // the value is an offset in seconds from now
      parameters.end = floorToHour(nowTs + parseInt(config.stats_end))
    }
  }

  return parameters
}

module.exports = { buildStatsParameters }
