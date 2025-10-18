// test/unit/price-schedule-transformer.test.js
const { transformPriceSchedule } = require('../../src/utils/price-schedule-transformer')

describe('Price Schedule Transformer', () => {
  const sampleData = {
    deGb: [
      [1760745600000, 0.302466725],
      [1760746500000, 0.302466725],
      [1760747400000, 0.302466725]
    ],
    deGs: [
      [1760745600000, 0.1065025],
      [1760746500000, 0.1065025],
      [1760747400000, 0.1065025]
    ]
  }

  describe('Basic Transformation', () => {
    it('should transform buy and sell prices into clear schedule', () => {
      const result = transformPriceSchedule(sampleData)

      expect(result.payload).toHaveLength(3)
      expect(result.payload[0]).toEqual({
        timestamp: 1760745600000,
        datetime: new Date(1760745600000).toISOString(),
        buyPrice: 0.302466725,
        sellPrice: 0.1065025,
        spread: expect.any(Number)
      })

      expect(result.metadata).toBeDefined()
      expect(result.metadata.intervalMinutes).toBe(15)
      expect(result.metadata.count).toBe(3)
    })

    it('should calculate spread correctly', () => {
      const result = transformPriceSchedule(sampleData)

      const expectedSpread = 0.302466725 - 0.1065025
      expect(result.payload[0].spread).toBeCloseTo(expectedSpread, 6)
    })

    it('should include correct metadata', () => {
      const result = transformPriceSchedule(sampleData)

      expect(result.metadata).toEqual({
        intervalMinutes: 15,
        count: 3,
        startTime: new Date(1760745600000).toISOString(),
        endTime: new Date(1760747400000).toISOString(),
        currency: 'EUR'
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing deGb data', () => {
      const data = {
        deGs: [[1760745600000, 0.1065025]]
      }
      const result = transformPriceSchedule(data)

      expect(result.payload[0].buyPrice).toBeNull()
      expect(result.payload[0].sellPrice).toBe(0.1065025)
      expect(result.payload[0].spread).toBeNull()
    })

    it('should handle missing deGs data', () => {
      const data = {
        deGb: [[1760745600000, 0.302466725]]
      }
      const result = transformPriceSchedule(data)

      expect(result.payload[0].buyPrice).toBe(0.302466725)
      expect(result.payload[0].sellPrice).toBeNull()
      expect(result.payload[0].spread).toBeNull()
    })

    it('should handle mismatched array lengths', () => {
      const data = {
        deGb: [
          [1760745600000, 0.302466725],
          [1760746500000, 0.302466725]
        ],
        deGs: [
          [1760745600000, 0.1065025]
        ]
      }
      const result = transformPriceSchedule(data)

      expect(result.payload).toHaveLength(2)
      expect(result.payload[1].sellPrice).toBeNull()
    })

    it('should handle empty data', () => {
      const data = { deGb: [], deGs: [] }
      const result = transformPriceSchedule(data)

      expect(result.payload).toHaveLength(0)
      expect(result.metadata.count).toBe(0)
      expect(result.metadata.startTime).toBeNull()
      expect(result.metadata.endTime).toBeNull()
    })

    it('should handle null input', () => {
      const result = transformPriceSchedule(null)

      expect(result.payload).toHaveLength(0)
      expect(result.metadata.count).toBe(0)
    })

    it('should handle undefined input', () => {
      const result = transformPriceSchedule(undefined)

      expect(result.payload).toHaveLength(0)
      expect(result.metadata.count).toBe(0)
    })

    it('should handle invalid input type', () => {
      const result = transformPriceSchedule('invalid')

      expect(result.payload).toHaveLength(0)
      expect(result.metadata.count).toBe(0)
    })
  })

  describe('Sorting', () => {
    it('should sort timestamps chronologically', () => {
      const unsortedData = {
        deGb: [
          [1760747400000, 0.3],
          [1760745600000, 0.3],
          [1760746500000, 0.3]
        ],
        deGs: [
          [1760747400000, 0.1],
          [1760745600000, 0.1],
          [1760746500000, 0.1]
        ]
      }

      const result = transformPriceSchedule(unsortedData)

      expect(result.payload[0].timestamp).toBe(1760745600000)
      expect(result.payload[1].timestamp).toBe(1760746500000)
      expect(result.payload[2].timestamp).toBe(1760747400000)
    })
  })

  describe('Real World Data', () => {
    it('should handle typical Dynamic ESS schedule data', () => {
      const realData = {
        deGb: [
          [1760745600000, 0.302466725],
          [1760746500000, 0.302466725],
          [1760747400000, 0.302466725],
          [1760748300000, 0.302466725],
          [1760749200000, 0.299242075]
        ],
        deGs: [
          [1760745600000, 0.1065025],
          [1760746500000, 0.1065025],
          [1760747400000, 0.1065025],
          [1760748300000, 0.1065025],
          [1760749200000, 0.1038375]
        ]
      }

      const result = transformPriceSchedule(realData)

      expect(result.payload).toHaveLength(5)
      expect(result.metadata.count).toBe(5)

      // Verify all entries have required fields
      result.payload.forEach(entry => {
        expect(entry).toHaveProperty('timestamp')
        expect(entry).toHaveProperty('datetime')
        expect(entry).toHaveProperty('buyPrice')
        expect(entry).toHaveProperty('sellPrice')
        expect(entry).toHaveProperty('spread')
      })
    })

    it('should handle 24 hour schedule (96 intervals)', () => {
      // Generate 96 15-minute intervals for 24 hours
      const startTime = 1760745600000
      const intervals = 96
      const intervalMs = 15 * 60 * 1000

      const deGb = []
      const deGs = []

      for (let i = 0; i < intervals; i++) {
        const timestamp = startTime + (i * intervalMs)
        deGb.push([timestamp, 0.25 + (Math.random() * 0.1)])
        deGs.push([timestamp, 0.10 + (Math.random() * 0.05)])
      }

      const result = transformPriceSchedule({ deGb, deGs })

      expect(result.payload).toHaveLength(96)
      expect(result.metadata.count).toBe(96)

      // Verify time span is approximately 24 hours
      const firstTime = new Date(result.payload[0].timestamp)
      const lastTime = new Date(result.payload[95].timestamp)
      const hoursDiff = (lastTime - firstTime) / (1000 * 60 * 60)
      expect(hoursDiff).toBeCloseTo(23.75, 1) // 95 intervals of 15 min = 23.75 hours
    })
  })
})
