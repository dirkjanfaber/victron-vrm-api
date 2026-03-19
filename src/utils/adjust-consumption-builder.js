'use strict'

/**
 * Build the body for POST /installations/{id}/adjust-consumption
 *
 * Accepts msg.payload in two forms:
 *
 * Simplified (single object or array of objects):
 *   { offset, ev?, hp?, base? }
 *   - offset: hours from current hour (0 = this hour), or absolute Unix timestamp
 *   - ev: EV charging Wh (>= 0 or -1 to reset)
 *   - hp: heat pump Wh (>= 0 or -1 to reset)
 *   - base: base load Wh (>= 0); when all three provided, total is auto-computed
 *
 * Raw pass-through (plain object with API keys):
 *   { vrm_consumption_fc_adj?, vrm_consum_evcs_fc_adj?, vrm_consum_hp_fc_adj? }
 *
 * Reset helper (msg.reset):
 *   Array of offsets or absolute timestamps - sets all fields to -1 for those hours.
 */
function buildAdjustConsumptionBody (payload, reset, nowMs) {
  const nowHour = Math.floor(nowMs / 1000 / 3600) * 3600

  function resolveTs (val) {
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
      throw new Error(`Invalid offset or timestamp: ${val}`)
    }
    // Values < 100000 are treated as hour offsets, larger values as Unix timestamps
    const ts = val < 100000 ? nowHour + Math.floor(val) * 3600 : Math.floor(val)
    if (ts % 3600 !== 0) {
      throw new Error(`Timestamp ${ts} is not aligned to a full hour`)
    }
    return ts
  }

  function validateValue (val, key) {
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new Error(`"${key}" must be a number`)
    }
    if (val !== -1 && val < 0) {
      throw new Error(`"${key}" must be >= 0 or -1 to reset`)
    }
  }

  // Reset path: build all-(-1) body for specified hours
  if (reset !== undefined && reset !== null) {
    const offsets = Array.isArray(reset) ? reset : [reset]
    if (offsets.length === 0) {
      throw new Error('msg.reset must not be empty')
    }
    const entries = offsets.map(o => ({ timestamp: resolveTs(o), value: -1 }))
    return {
      vrm_consumption_fc_adj: entries,
      vrm_consum_evcs_fc_adj: entries,
      vrm_consum_hp_fc_adj: entries
    }
  }

  if (payload === undefined || payload === null) {
    throw new Error('msg.payload is required')
  }

  // Raw pass-through: plain object with known API keys
  if (
    !Array.isArray(payload) &&
    payload.offset === undefined &&
    (payload.vrm_consumption_fc_adj !== undefined ||
      payload.vrm_consum_evcs_fc_adj !== undefined ||
      payload.vrm_consum_hp_fc_adj !== undefined)
  ) {
    return payload
  }

  // Simplified format: single object or array of objects
  const entries = Array.isArray(payload) ? payload : [payload]
  if (entries.length === 0) {
    throw new Error('msg.payload must not be empty')
  }

  const totalEntries = []
  const evEntries = []
  const hpEntries = []

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('Each payload entry must be an object')
    }
    if (entry.offset === undefined) {
      throw new Error('Each payload entry must have an "offset" field')
    }

    const ts = resolveTs(entry.offset)

    if (entry.ev !== undefined) {
      validateValue(entry.ev, 'ev')
      evEntries.push({ timestamp: ts, value: entry.ev })
    }
    if (entry.hp !== undefined) {
      validateValue(entry.hp, 'hp')
      hpEntries.push({ timestamp: ts, value: entry.hp })
    }

    // Auto-compute total only when all three non-reset values are provided
    if (entry.ev !== undefined && entry.hp !== undefined && entry.base !== undefined &&
        entry.ev !== -1 && entry.hp !== -1) {
      validateValue(entry.base, 'base')
      if (entry.base < 0) {
        throw new Error('"base" must be >= 0')
      }
      totalEntries.push({ timestamp: ts, value: entry.ev + entry.hp + entry.base })
    }
  }

  const body = {}
  if (totalEntries.length > 0) body.vrm_consumption_fc_adj = totalEntries
  if (evEntries.length > 0) body.vrm_consum_evcs_fc_adj = evEntries
  if (hpEntries.length > 0) body.vrm_consum_hp_fc_adj = hpEntries

  if (Object.keys(body).length === 0) {
    throw new Error('No adjustable fields in msg.payload. Provide at least one of: ev, hp (and base to set total)')
  }

  return body
}

module.exports = { buildAdjustConsumptionBody }
