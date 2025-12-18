// test/unit/test-offset-handling.test.js
// Test to go with PR #36

const { buildStatsParameters } = require('../../src/utils/stats-parameters')

describe('Offset handling for stats_end (PR #36)', () => {
  const fixedDate = new Date('2023-10-15T14:30:00.000Z')
  let OriginalDate

  beforeAll(() => {
    OriginalDate = Date
    global.Date = class extends Date {
      constructor (...args) {
        if (args.length === 0) {
          return new OriginalDate(fixedDate)
        }
        return new OriginalDate(...args)
      }

      static now () {
        return fixedDate.getTime()
      }
    }
  })

  afterAll(() => {
    global.Date = OriginalDate
  })

  describe('stats_end offset should be added, not subtracted', () => {
    const nowTs = Math.floor(fixedDate.getTime() / 1000) // 1697380200

    it('should handle +24 hours offset for end time (86400 seconds)', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'now',
        stats_end: '86400' // +24 hours from now
      }

      const result = buildStatsParameters(config)

      // After PR #36: nowTs + 86400
      const expectedEnd = nowTs + 86400
      const flooredEnd = expectedEnd - (expectedEnd % 3600)

      expect(result.end).toBe(flooredEnd)
      expect(result.end).toBeGreaterThan(result.start)
    })

    it('should handle +48 hours offset for end time (172800 seconds)', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'now',
        stats_end: '172800' // +48 hours from now
      }

      const result = buildStatsParameters(config)

      const expectedEnd = nowTs + 172800
      const flooredEnd = expectedEnd - (expectedEnd % 3600)

      expect(result.end).toBe(flooredEnd)
      expect(result.end).toBeGreaterThan(result.start)
    })

    it('should handle +72 hours offset for end time (259200 seconds)', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'now',
        stats_end: '259200' // +72 hours from now
      }

      const result = buildStatsParameters(config)

      const expectedEnd = nowTs + 259200
      const flooredEnd = expectedEnd - (expectedEnd % 3600)

      expect(result.end).toBe(flooredEnd)
      expect(result.end).toBeGreaterThan(result.start)
    })

    it('should create valid time range when start is "bod" and end is +24 hours', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'bod', // beginning of day
        stats_end: '86400' // +24 hours from now
      }

      const result = buildStatsParameters(config)

      const expectedStart = Math.floor(new Date('2023-10-15T00:00:00.000').getTime() / 1000)
      expect(result.start).toBe(expectedStart)

      const expectedEnd = nowTs + 86400
      const flooredEnd = expectedEnd - (expectedEnd % 3600)
      expect(result.end).toBe(flooredEnd)

      expect(result.end).toBeGreaterThan(result.start)
    })

    it('should handle time range from negative start offset to positive end offset', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: '-3600', // -1 hour (1 hour ago)
        stats_end: '86400' // +24 hours from now
      }

      const result = buildStatsParameters(config)

      const expectedStart = nowTs + parseInt(config.stats_start)
      const flooredStart = expectedStart - (expectedStart % 3600)
      expect(result.start).toBe(flooredStart)

      const expectedEnd = nowTs + parseInt(config.stats_end)
      const flooredEnd = expectedEnd - (expectedEnd % 3600)
      expect(result.end).toBe(flooredEnd)

      // Both should create a valid range
      expect(result.end).toBeGreaterThan(result.start)

      // Range should be approximately 25 hours
      const rangeDuration = result.end - result.start
      expect(rangeDuration).toBeCloseTo(90000, -3) // 25 hours = 90000 seconds
    })
  })

  describe('Edge case: offset of 0 should work for both start and end', () => {
    const nowTs = Math.floor(fixedDate.getTime() / 1000)

    it('should handle 0 offset correctly', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: '0',
        stats_end: '0'
      }

      const result = buildStatsParameters(config)

      const flooredNow = nowTs - (nowTs % 3600)

      // Both should be "now"
      expect(result.start).toBe(flooredNow)
      expect(result.end).toBe(flooredNow)
    })
  })

  describe('Real-world scenario from Node-RED UI options', () => {
    it('should match expected behavior for UI option: End = +24 hours', () => {
      // This mirrors the HTML option: <option selected="selected" value="86400">+24 hours</option>
      const config = {
        attribute: 'Ac/ActiveIn/L1/Power',
        stats_interval: 'hours',
        stats_start: 'bod',
        stats_end: '86400' // This is what gets sent when user selects "+24 hours"
      }

      const result = buildStatsParameters(config)

      // User expectation: data from beginning of today until 24 hours from now
      const startOfDay = Math.floor(new Date('2023-10-15T00:00:00.000').getTime() / 1000)
      expect(result.start).toBe(startOfDay)

      // The end should be approximately 24 hours from NOW, not from start of day
      const nowTs = Math.floor(fixedDate.getTime() / 1000)
      const expectedEnd = nowTs + 86400
      const flooredEnd = expectedEnd - (expectedEnd % 3600)
      expect(result.end).toBe(flooredEnd)

      // And crucially, end must be after start
      expect(result.end).toBeGreaterThan(result.start)
    })
  })
})
