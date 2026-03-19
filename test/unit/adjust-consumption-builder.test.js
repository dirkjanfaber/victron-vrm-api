'use strict'

const { buildAdjustConsumptionBody } = require('../../src/utils/adjust-consumption-builder')

// Fixed reference time: 2026-01-01 12:00:00 UTC (a full hour)
const NOW_MS = 1735732800000 // 2026-01-01T12:00:00Z in ms
const NOW_HOUR = 1735732800 // same in seconds

describe('buildAdjustConsumptionBody', () => {
  describe('simplified format - single object', () => {
    it('should compute timestamp from offset 0', () => {
      const body = buildAdjustConsumptionBody({ offset: 0, ev: 1000 }, undefined, NOW_MS)
      expect(body.vrm_consum_evcs_fc_adj[0].timestamp).toBe(NOW_HOUR)
    })

    it('should compute timestamp from offset 2', () => {
      const body = buildAdjustConsumptionBody({ offset: 2, ev: 1000 }, undefined, NOW_MS)
      expect(body.vrm_consum_evcs_fc_adj[0].timestamp).toBe(NOW_HOUR + 2 * 3600)
    })

    it('should set ev only', () => {
      const body = buildAdjustConsumptionBody({ offset: 1, ev: 5000 }, undefined, NOW_MS)
      expect(body.vrm_consum_evcs_fc_adj).toEqual([{ timestamp: NOW_HOUR + 3600, value: 5000 }])
      expect(body.vrm_consum_hp_fc_adj).toBeUndefined()
      expect(body.vrm_consumption_fc_adj).toBeUndefined()
    })

    it('should set hp only', () => {
      const body = buildAdjustConsumptionBody({ offset: 1, hp: 3000 }, undefined, NOW_MS)
      expect(body.vrm_consum_hp_fc_adj).toEqual([{ timestamp: NOW_HOUR + 3600, value: 3000 }])
      expect(body.vrm_consum_evcs_fc_adj).toBeUndefined()
      expect(body.vrm_consumption_fc_adj).toBeUndefined()
    })

    it('should auto-compute total when ev + hp + base are all provided', () => {
      const body = buildAdjustConsumptionBody({ offset: 0, ev: 10500, hp: 4000, base: 2000 }, undefined, NOW_MS)
      expect(body.vrm_consumption_fc_adj).toEqual([{ timestamp: NOW_HOUR, value: 16500 }])
      expect(body.vrm_consum_evcs_fc_adj).toEqual([{ timestamp: NOW_HOUR, value: 10500 }])
      expect(body.vrm_consum_hp_fc_adj).toEqual([{ timestamp: NOW_HOUR, value: 4000 }])
    })

    it('should not compute total when base is missing', () => {
      const body = buildAdjustConsumptionBody({ offset: 0, ev: 10500, hp: 4000 }, undefined, NOW_MS)
      expect(body.vrm_consumption_fc_adj).toBeUndefined()
      expect(body.vrm_consum_evcs_fc_adj).toBeDefined()
      expect(body.vrm_consum_hp_fc_adj).toBeDefined()
    })

    it('should not compute total when ev is -1', () => {
      const body = buildAdjustConsumptionBody({ offset: 0, ev: -1, hp: 4000, base: 2000 }, undefined, NOW_MS)
      expect(body.vrm_consumption_fc_adj).toBeUndefined()
      expect(body.vrm_consum_evcs_fc_adj).toEqual([{ timestamp: NOW_HOUR, value: -1 }])
      expect(body.vrm_consum_hp_fc_adj).toEqual([{ timestamp: NOW_HOUR, value: 4000 }])
    })

    it('should accept absolute Unix timestamp as offset', () => {
      const ts = NOW_HOUR + 3600
      const body = buildAdjustConsumptionBody({ offset: ts, ev: 1000 }, undefined, NOW_MS)
      expect(body.vrm_consum_evcs_fc_adj[0].timestamp).toBe(ts)
    })
  })

  describe('simplified format - array', () => {
    it('should process multiple entries', () => {
      const body = buildAdjustConsumptionBody([
        { offset: 0, ev: 1000, hp: 500, base: 200 },
        { offset: 1, ev: 2000, hp: 600, base: 300 }
      ], undefined, NOW_MS)
      expect(body.vrm_consum_evcs_fc_adj).toHaveLength(2)
      expect(body.vrm_consum_hp_fc_adj).toHaveLength(2)
      expect(body.vrm_consumption_fc_adj).toHaveLength(2)
      expect(body.vrm_consumption_fc_adj[0].value).toBe(1700)
      expect(body.vrm_consumption_fc_adj[1].value).toBe(2900)
    })
  })

  describe('reset path', () => {
    it('should build all-(-1) body from offset array', () => {
      const body = buildAdjustConsumptionBody(null, [0, 1, 2], NOW_MS)
      expect(body.vrm_consumption_fc_adj).toHaveLength(3)
      expect(body.vrm_consum_evcs_fc_adj).toHaveLength(3)
      expect(body.vrm_consum_hp_fc_adj).toHaveLength(3)
      expect(body.vrm_consumption_fc_adj[0]).toEqual({ timestamp: NOW_HOUR, value: -1 })
      expect(body.vrm_consumption_fc_adj[1]).toEqual({ timestamp: NOW_HOUR + 3600, value: -1 })
    })

    it('should accept single reset value (not array)', () => {
      const body = buildAdjustConsumptionBody(null, 1, NOW_MS)
      expect(body.vrm_consumption_fc_adj).toHaveLength(1)
      expect(body.vrm_consumption_fc_adj[0].value).toBe(-1)
    })

    it('should accept absolute timestamps in reset', () => {
      const ts = NOW_HOUR + 3600
      const body = buildAdjustConsumptionBody(null, [ts], NOW_MS)
      expect(body.vrm_consumption_fc_adj[0].timestamp).toBe(ts)
    })

    it('should throw on empty reset array', () => {
      expect(() => buildAdjustConsumptionBody(null, [], NOW_MS)).toThrow('msg.reset must not be empty')
    })
  })

  describe('raw pass-through', () => {
    it('should pass through raw API format unchanged', () => {
      const raw = {
        vrm_consumption_fc_adj: [{ timestamp: NOW_HOUR + 3600, value: 5000 }],
        vrm_consum_evcs_fc_adj: [{ timestamp: NOW_HOUR + 3600, value: 2000 }]
      }
      const body = buildAdjustConsumptionBody(raw, undefined, NOW_MS)
      expect(body).toBe(raw)
    })
  })

  describe('validation', () => {
    it('should throw when offset is missing', () => {
      expect(() => buildAdjustConsumptionBody({ ev: 1000 }, undefined, NOW_MS))
        .toThrow('offset')
    })

    it('should throw when ev is not a number', () => {
      expect(() => buildAdjustConsumptionBody({ offset: 0, ev: 'bad' }, undefined, NOW_MS))
        .toThrow('"ev" must be a number')
    })

    it('should throw when ev is negative (not -1)', () => {
      expect(() => buildAdjustConsumptionBody({ offset: 0, ev: -5 }, undefined, NOW_MS))
        .toThrow('"ev" must be >= 0 or -1')
    })

    it('should throw when base is negative', () => {
      expect(() => buildAdjustConsumptionBody({ offset: 0, ev: 1000, hp: 500, base: -100 }, undefined, NOW_MS))
        .toThrow('"base" must be >= 0')
    })

    it('should throw on empty payload array', () => {
      expect(() => buildAdjustConsumptionBody([], undefined, NOW_MS))
        .toThrow('must not be empty')
    })

    it('should throw when no adjustable fields are provided', () => {
      expect(() => buildAdjustConsumptionBody({ offset: 0 }, undefined, NOW_MS))
        .toThrow('No adjustable fields')
    })

    it('should throw when payload is null and no reset', () => {
      expect(() => buildAdjustConsumptionBody(null, undefined, NOW_MS))
        .toThrow('msg.payload is required')
    })
  })
})
