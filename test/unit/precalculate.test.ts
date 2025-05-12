import { describe, test, expect } from 'bun:test'
import type { ContestRules } from '../../src/lib/types'
import { getRulesContext } from 'lib/precalculate'

describe('Precalculate', () => {
  test('getRulesContext preprocesses timeRanges correctly', () => {
    const rules: ContestRules = {
      name: 'Test Contest',
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z',
      rules: {
        validation: [
          'timeRange',
          [
            'uniqueContactsByTimeRange',
            {
              firstDay: ['2024-12-01T00:00:00Z', '2024-12-15T23:59:59Z'],
              secondDay: ['2024-12-16T00:00:00Z', '2024-12-31T23:59:59Z'],
            },
          ],
        ],
        scoring: [['timeRange', { firstDay: 1, secondDay: 2 }]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'],
      },
    }

    const rulesContext = getRulesContext(rules)

    // Check if timeRanges are parsed correctly
    expect(rulesContext.timeRanges).toBeDefined()
    expect(Object.keys(rulesContext.timeRanges).length).toBe(2)

    // Check first day range
    expect(rulesContext.timeRanges.firstDay).toBeDefined()
    expect(rulesContext.timeRanges.firstDay?.start instanceof Date).toBe(true)
    expect(rulesContext.timeRanges.firstDay?.start.toISOString()).toBe(
      '2024-12-01T00:00:00.000Z'
    )
    expect(rulesContext.timeRanges.firstDay?.end.toISOString()).toBe(
      '2024-12-15T23:59:59.000Z'
    )

    // Check second day range
    expect(rulesContext.timeRanges.secondDay).toBeDefined()
    expect(rulesContext.timeRanges.secondDay?.start instanceof Date).toBe(true)
    expect(rulesContext.timeRanges.secondDay?.start.toISOString()).toBe(
      '2024-12-16T00:00:00.000Z'
    )
    expect(rulesContext.timeRanges.secondDay?.end.toISOString()).toBe(
      '2024-12-31T23:59:59.000Z'
    )
  })

  test('getRulesContext preprocesses bandRanges correctly', () => {
    const rules: ContestRules = {
      name: 'Test Contest',
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z',
      rules: {
        validation: [
          'timeRange',
          [
            'bands',
            {
              '40m': ['7080', '7140'],
              '20m': ['14000', '14350'],
            },
          ],
        ],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'],
      },
    }

    const rulesContext = getRulesContext(rules)

    // Check if bandRanges are parsed correctly
    expect(rulesContext.bandRanges).toBeDefined()
    expect(rulesContext.bandRanges.length).toBe(2)

    // Check 40m band
    const band40m = rulesContext.bandRanges.find(range => range.start === 7080)
    expect(band40m).toBeDefined()
    expect(band40m?.start).toBe(7080)
    expect(band40m?.end).toBe(7140)

    // Check 20m band
    const band20m = rulesContext.bandRanges.find(range => range.start === 14000)
    expect(band20m).toBeDefined()
    expect(band20m?.start).toBe(14000)
    expect(band20m?.end).toBe(14350)
  })

  test('getRulesContext handles empty/missing rules', () => {
    // Rules without timeRanges or bandRanges
    const basicRules: ContestRules = {
      name: 'Basic Test Contest',
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z',
      rules: {
        validation: ['timeRange'],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'],
      },
    }

    const rulesContext = getRulesContext(basicRules)

    // Should have empty objects/arrays for missing config
    expect(rulesContext.timeRanges).toEqual({})
    expect(rulesContext.bandRanges).toEqual([])

    // Should still have the original rules
    expect(rulesContext.contestRules).toBe(basicRules)
  })
})
