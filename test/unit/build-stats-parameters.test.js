// test/unit/build-stats-parameters.test.js

const { buildStatsParameters } = require('../../src/utils/stats-parameters')

describe('buildStatsParameters', () => {
  // Helper to create a fixed date for consistent testing
  const fixedDate = new Date('2023-10-15T14:30:00.000Z') // Sunday, October 15, 2023, 14:30 UTC
  let OriginalDate

  beforeAll(() => {
    // Mock Date to return consistent results
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

  describe('Basic parameter building', () => {
    it('should build parameters for custom attribute', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_interval: 'hours'
      }

      const result = buildStatsParameters(config)

      expect(result).toEqual({
        type: 'custom',
        'attributeCodes[]': 'Dc/0/Power',
        interval: 'hours'
      })
    })

    it('should build parameters for dynamic_ess attribute', () => {
      const config = {
        attribute: 'dynamic_ess'
      }

      const result = buildStatsParameters(config)

      expect(result).toEqual({
        interval: 'hours',
        type: 'dynamic_ess'
      })
    })

    it('should build parameters for evcs attribute', () => {
      const config = {
        attribute: 'evcs'
      }

      const result = buildStatsParameters(config)

      expect(result).toEqual({
        type: 'evcs'
      })
    })

    it('should include show_instance when enabled', () => {
      const config = {
        attribute: 'Dc/0/Power',
        show_instance: true
      }

      const result = buildStatsParameters(config)

      expect(result).toEqual({
        type: 'custom',
        'attributeCodes[]': 'Dc/0/Power',
        show_instance: 1
      })
    })
  })

  describe('Start time parameter handling', () => {
    const nowTs = Math.floor(fixedDate.getTime() / 1000) // 1697380200

    it('should handle "now" start time', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'now'
      }

      const result = buildStatsParameters(config)

      // Should floor to hour: 1697380200 - (1697380200 % 3600) = 1697378400
      expect(result.start).toBe(1697378400)
    })

    it('should handle "bod" (beginning of day) start time', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'bod'
      }

      const result = buildStatsParameters(config)

      // Should be start of October 15, 2023 (local time)
      const expectedStart = Math.floor(new Date('2023-10-15T00:00:00.000').getTime() / 1000)
      expect(result.start).toBe(expectedStart)
    })

    it('should handle "bod" with UTC enabled', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'bod',
        use_utc: true
      }

      const result = buildStatsParameters(config)

      // Should be start of October 15, 2023 UTC
      const expectedStart = Math.floor(new Date('2023-10-15T00:00:00.000Z').getTime() / 1000)
      expect(result.start).toBe(expectedStart)
    })

    it('should handle "boy" (beginning of yesterday) start time', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'boy'
      }

      const result = buildStatsParameters(config)

      // Should be start of October 14, 2023 (local time)
      const expectedStart = Math.floor(new Date('2023-10-14T00:00:00.000').getTime() / 1000)
      expect(result.start).toBe(expectedStart)
    })

    it('should handle "bot" (beginning of tomorrow) start time', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'bot'
      }

      const result = buildStatsParameters(config)

      // Should be start of October 16, 2023 (local time)
      const expectedStart = Math.floor(new Date('2023-10-16T00:00:00.000').getTime() / 1000)
      expect(result.start).toBe(expectedStart)
    })

    it('should handle negative numeric offset for start time (past)', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: '-3600' // 1 hour ago
      }

      const result = buildStatsParameters(config)

      const expectedStart = nowTs - 3600
      const flooredStart = expectedStart - (expectedStart % 3600)
      expect(result.start).toBe(flooredStart)
    })

    it('should handle positive numeric offset for start time (future)', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: '3600' // 1 hour from now
      }

      const result = buildStatsParameters(config)

      const expectedStart = nowTs + 3600
      const flooredStart = expectedStart - (expectedStart % 3600)
      expect(result.start).toBe(flooredStart)
    })

    it('should not set start time for invalid values', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: 'invalid'
      }

      const result = buildStatsParameters(config)

      expect(result.start).toBeUndefined()
    })
  })

  describe('End time parameter handling', () => {
    const nowTs = Math.floor(fixedDate.getTime() / 1000) // 1697380200

    it('should handle "eod" (end of day) end time', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_end: 'eod'
      }

      const result = buildStatsParameters(config)

      // Should be start of October 16, 2023 (local time) - 00:00:00 of next day
      const expectedEnd = Math.floor(new Date('2023-10-16T00:00:00.000').getTime() / 1000)
      expect(result.end).toBe(expectedEnd)
    })

    it('should handle "eod" with UTC enabled', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_end: 'eod',
        use_utc: true
      }

      const result = buildStatsParameters(config)

      // Should be start of October 16, 2023 UTC - 00:00:00 of next day
      const expectedEnd = Math.floor(new Date('2023-10-16T00:00:00.000Z').getTime() / 1000)
      expect(result.end).toBe(expectedEnd)
    })

    it('should handle "eoy" (end of yesterday) end time', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_end: 'eoy'
      }

      const result = buildStatsParameters(config)

      const endOfYesterday = new Date(fixedDate)
      endOfYesterday.setDate(endOfYesterday.getDate() - 1)
      endOfYesterday.setHours(23, 59, 59, 999)
      const expectedEnd = Math.floor(endOfYesterday.getTime() / 1000)
      expect(result.end).toBe(expectedEnd)
    })

    it('should handle "eoy" end time with UTC enabled', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_end: 'eoy',
        use_utc: true
      }

      const result = buildStatsParameters(config)

      const endOfYesterday = new Date(fixedDate)
      endOfYesterday.setDate(endOfYesterday.getDate() - 1)
      endOfYesterday.setUTCHours(23, 59, 59, 999)
      const expectedEnd = Math.floor(endOfYesterday.getTime() / 1000)
      expect(result.end).toBe(expectedEnd)
    })

    it('should handle "eoyr" (end of year) end time', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_end: 'eoyr'
      }

      const result = buildStatsParameters(config)

      const endOfYear = new Date(fixedDate)
      endOfYear.setFullYear(endOfYear.getFullYear(), 11, 31)
      endOfYear.setHours(23, 59, 59, 999)
      const expectedEnd = Math.floor(endOfYear.getTime() / 1000)
      expect(result.end).toBe(expectedEnd)
    })

    it('should handle "eoyr" end time with UTC enabled', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_end: 'eoyr',
        use_utc: true
      }

      const result = buildStatsParameters(config)

      const endOfYear = new Date(fixedDate)
      endOfYear.setUTCFullYear(endOfYear.getUTCFullYear(), 11, 31)
      endOfYear.setUTCHours(23, 59, 59, 999)
      const expectedEnd = Math.floor(endOfYear.getTime() / 1000)
      expect(result.end).toBe(expectedEnd)
    })

    it('should handle numeric offset for end time', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_end: '7200' // 2 hours ago
      }

      const result = buildStatsParameters(config)

      // Should be now + 7200 seconds, floored to hour
      const expectedEnd = nowTs + 7200
      const flooredEnd = expectedEnd - (expectedEnd % 3600)
      expect(result.end).toBe(flooredEnd)
    })

    it('should not set end time for invalid values', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_end: 'invalid'
      }

      const result = buildStatsParameters(config)

      expect(result.end).toBeUndefined()
    })
  })

  describe('Complex configuration scenarios', () => {
    it('should handle full configuration with all parameters', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_interval: 'hours',
        show_instance: true,
        stats_start: 'bod',
        stats_end: 'eod',
        use_utc: true
      }

      const result = buildStatsParameters(config)

      expect(result).toEqual({
        type: 'custom',
        'attributeCodes[]': 'Dc/0/Power',
        interval: 'hours',
        show_instance: 1,
        start: Math.floor(new Date('2023-10-15T00:00:00.000Z').getTime() / 1000),
        end: Math.floor(new Date('2023-10-16T00:00:00.000Z').getTime() / 1000)
      })
    })

    it('should handle dynamic_ess with time parameters', () => {
      const config = {
        attribute: 'dynamic_ess',
        stats_start: 'now',
        stats_end: 'eod'
      }

      const result = buildStatsParameters(config)

      expect(result.type).toBe('dynamic_ess')
      expect(result['attributeCodes[]']).toBeUndefined()
      expect(result.start).toBeDefined()
      expect(result.end).toBeDefined()
    })

    it('should handle evcs with time parameters', () => {
      const config = {
        attribute: 'evcs',
        stats_start: 'boy',
        stats_end: 'now'
      }

      const result = buildStatsParameters(config)

      expect(result.type).toBe('evcs')
      expect(result['attributeCodes[]']).toBeUndefined()
      expect(result.start).toBeDefined()
      expect(result.end).toBeUndefined() // 'now' is not a valid end time option
    })
  })

  describe('Edge cases', () => {
    it('should handle empty config', () => {
      const config = {}

      const result = buildStatsParameters(config)

      expect(result).toEqual({
        type: 'custom',
        'attributeCodes[]': undefined
      })
    })

    it('should handle config with only time parameters', () => {
      const config = {
        stats_start: 'bod',
        stats_end: 'eod'
      }

      const result = buildStatsParameters(config)

      expect(result.type).toBe('custom')
      expect(result.start).toBeDefined()
      expect(result.end).toBeDefined()
    })

    it('should handle zero numeric offset', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: '0',
        stats_end: '0'
      }

      const result = buildStatsParameters(config)

      const nowTs = Math.floor(fixedDate.getTime() / 1000)
      const flooredNow = nowTs - (nowTs % 3600)

      expect(result.start).toBe(flooredNow)
      expect(result.end).toBe(flooredNow)
    })

    it('should handle -24 hours offset (issue #45)', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: '-86400' // -24 hours (from UI dropdown)
      }

      const result = buildStatsParameters(config)

      const nowTs = Math.floor(fixedDate.getTime() / 1000)
      const expectedStart = nowTs - 86400
      const flooredStart = expectedStart - (expectedStart % 3600)

      expect(result.start).toBe(flooredStart)
      expect(result.start).toBeLessThan(nowTs)
    })

    it('should handle -48 hours offset (issue #45)', () => {
      const config = {
        attribute: 'Dc/0/Power',
        stats_start: '-172800' // -48 hours (from UI dropdown)
      }

      const result = buildStatsParameters(config)

      const nowTs = Math.floor(fixedDate.getTime() / 1000)
      const expectedStart = nowTs - 172800
      const flooredStart = expectedStart - (expectedStart % 3600)

      expect(result.start).toBe(flooredStart)
      expect(result.start).toBeLessThan(nowTs)
    })
  })
})
