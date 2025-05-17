import { describe, test, expect, beforeEach } from 'bun:test'
import type {
  ContestRules,
  ScoringContext,
  ValidContact,
  RulesContext,
} from '../../src/lib/types'
import { bonusers } from 'lib/rules/bonusers'
import { applyBonusRules } from 'lib/bonus'
import { getRulesContext } from 'lib/precalculate'

describe('Bonusers', () => {
  let sampleRules: ContestRules
  let validContacts: Map<string, ValidContact[]>
  let scoringContext: ScoringContext
  let rulesContext: RulesContext

  beforeEach(() => {
    // Setup sample rules
    sampleRules = {
      name: 'Test Contest',
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z',
      rules: {
        validation: [
          'timeRange',
          ['bands', { '40m': ['7080', '7140'], '20m': ['14000', '14350'] }],
          ['mode', ['SSB', 'CW', 'FT8']],
        ],
        scoring: [
          ['timeRange', { firstDay: 1, secondDay: 2 }],
          ['bonusStations', { OA4O: 5, OA4EFJ: 3 }],
        ],
        bonus: [
          ['default', 1.5], // 1.5x bonus multiplier
        ],
        tiebreaker: ['validStations'],
      },
    }

    rulesContext = getRulesContext(sampleRules)

    // Setup sample scored contacts
    validContacts = new Map<string, ValidContact[]>()

    // OA4T has 6 points (1 + 2 + 3)
    validContacts.set('OA4T', [
      {
        callsign: 'OA4T',
        contactedCallsign: 'OA4P',
        date: '20241210',
        time: '120000',
        freq: '14.000',
        band: '20m',
        mode: 'SSB',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1, // 1 point for first day
      },
      {
        callsign: 'OA4T',
        contactedCallsign: 'OA4P',
        date: '20241220',
        time: '130000',
        band: '40m',
        freq: '7.100',
        mode: 'CW',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 2, // 2 points for second day
      },
      {
        callsign: 'OA4T',
        contactedCallsign: 'OA4EFJ', // Bonus station
        date: '20241220',
        time: '140000',
        freq: '7.100',
        band: '40m',
        mode: 'CW',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 3, // 3 points for OA4EFJ on second day
      },
    ])

    // OA4P has 3 points (1 + 2)
    validContacts.set('OA4P', [
      {
        callsign: 'OA4P',
        contactedCallsign: 'OA4T',
        date: '20241210',
        time: '120000',
        freq: '14.000',
        band: '20m',
        mode: 'SSB',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1, // 1 point for first day
      },
      {
        callsign: 'OA4P',
        contactedCallsign: 'OA4T',
        date: '20241220',
        time: '130000',
        freq: '7.100',
        band: '40m',
        mode: 'CW',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 2, // 2 points for second day
      },
    ])

    // Create timeRanges for the scoring context
    const timeRanges = {
      firstDay: {
        start: new Date('2024-12-01T00:00:00Z'),
        end: new Date('2024-12-15T23:59:59Z'),
      },
      secondDay: {
        start: new Date('2024-12-16T00:00:00Z'),
        end: new Date('2024-12-31T23:59:59Z'),
      },
    }

    scoringContext = {
      validContacts,
      timeRanges,
    }
  })

  test('defaultBonus multiplies the score by the specified multiplier', () => {
    const contact = validContacts.get('OA4T')![0] // 1 point

    // Test with default parameter (1)
    const defaultMultiplier = bonusers.default(contact?.score, scoringContext)
    expect(defaultMultiplier).toBe(1) // 1 * 1 = 1

    // Test with custom multiplier (1.5)
    const customMultiplier = bonusers.default(
      contact?.score,
      scoringContext,
      1.5
    )
    expect(customMultiplier).toBe(1.5) // 1 * 1.5 = 1.5

    // Test with higher-scored contact
    const higherScoredContact = validContacts.get('OA4T')![2] // 3 points
    const higherMultiplier = bonusers.default(
      higherScoredContact?.score,
      scoringContext,
      2
    )
    expect(higherMultiplier).toBe(6) // 3 * 2 = 6

    // Test with zero multiplier
    const zeroMultiplier = bonusers.default(contact?.score, scoringContext, 0)
    expect(zeroMultiplier).toBe(0) // 1 * 0 = 0
  })

  test('applyBonusRules calculates final scores correctly', () => {
    // Apply the bonus rules to the scored contacts
    const results = applyBonusRules(validContacts, sampleRules, rulesContext)

    // Sort results by score (highest first)
    const sortedResults = results.sort((a, b) => b[1] - a[1])

    // OA4T should have 9 points (6 * 1.5 = 9)
    const oa4tScore = sortedResults.find(
      ([callsign]) => callsign === 'OA4T'
    )?.[1]
    expect(oa4tScore).toBe(9)

    // OA4P should have 4.5 points (3 * 1.5 = 4.5)
    const oa4pScore = sortedResults.find(
      ([callsign]) => callsign === 'OA4P'
    )?.[1]
    expect(oa4pScore).toBe(4.5)

    // OA4T should be first (highest score)
    expect(sortedResults[0]?.[0]).toBe('OA4T')

    // OA4P should be second
    expect(sortedResults[1]?.[0]).toBe('OA4P')
  })

  test('applyBonusRules handles multiple bonus rules in sequence', () => {
    // Create rules with multiple bonus rules
    const rulesWithMultipleBonuses: ContestRules = {
      ...sampleRules,
      rules: {
        ...sampleRules.rules,
        bonus: [
          ['default', 2], // First multiply by 2
          ['default', 1.5], // Then multiply by 1.5
        ],
      },
    }

    // Apply the multiple bonus rules
    const results = applyBonusRules(
      validContacts,
      rulesWithMultipleBonuses,
      rulesContext
    )

    // Sort results by score (highest first)
    const sortedResults = results.sort((a, b) => b[1] - a[1])

    // OA4T should have 18 points (6 * 2 * 1.5 = 18)
    const oa4tScore = sortedResults.find(
      ([callsign]) => callsign === 'OA4T'
    )?.[1]
    expect(oa4tScore).toBe(18)

    // OA4P should have 9 points (3 * 2 * 1.5 = 9)
    const oa4pScore = sortedResults.find(
      ([callsign]) => callsign === 'OA4P'
    )?.[1]
    expect(oa4pScore).toBe(9)
  })
})
