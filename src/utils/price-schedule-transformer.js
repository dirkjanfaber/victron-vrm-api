'use strict'

/**
 * Transform VRM Dynamic ESS price data into a clear schedule
 *
 * @param {Object} data - Raw VRM API response containing deGb and deGs
 * @param {Array} data.deGb - Buy prices (grid to battery) as [timestamp, price][]
 * @param {Array} data.deGs - Sell prices (battery to grid) as [timestamp, price][]
 * @returns {Array} Transformed price schedule with metadata
 */
function transformPriceSchedule (data) {
  if (!data || typeof data !== 'object') {
    return {
      payload: [],
      metadata: {
        intervalMinutes: 15,
        count: 0,
        startTime: null,
        endTime: null,
        currency: 'EUR'
      }
    }
  }

  const deGb = data.deGb || []
  const deGs = data.deGs || []

  // Create a map for efficient lookup
  const priceMap = new Map()

  // Add buy prices
  deGb.forEach(([timestamp, price]) => {
    if (!priceMap.has(timestamp)) {
      priceMap.set(timestamp, {})
    }
    priceMap.get(timestamp).buyPrice = price
  })

  // Add sell prices
  deGs.forEach(([timestamp, price]) => {
    if (!priceMap.has(timestamp)) {
      priceMap.set(timestamp, {})
    }
    priceMap.get(timestamp).sellPrice = price
  })

  // Convert to array and sort by timestamp
  const schedule = Array.from(priceMap.entries())
    .map(([timestamp, prices]) => ({
      timestamp,
      datetime: new Date(timestamp).toISOString(),
      buyPrice: prices.buyPrice ?? null,
      sellPrice: prices.sellPrice ?? null,
      spread: (prices.buyPrice && prices.sellPrice)
        ? prices.buyPrice - prices.sellPrice
        : null
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  return {
    payload: schedule,
    metadata: {
      intervalMinutes: 15,
      count: schedule.length,
      startTime: schedule[0]?.datetime || null,
      endTime: schedule[schedule.length - 1]?.datetime || null,
      currency: 'EUR'
    }
  }
}

module.exports = { transformPriceSchedule }
