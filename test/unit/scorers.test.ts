import { describe, test, expect, beforeEach } from 'bun:test'
import type { SimpleAdif } from 'adif-parser-ts'
import type {
  ContestRules,
  ScoringContext,
  ValidContact,
  RulesContext,
} from '../../src/lib/types'
import { scorers } from 'lib/rules/scorers'
import { scoreContacts } from 'lib/scorer'
import { getRulesContext } from 'lib/precalculate'

describe('Scorers', () => {
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
          'contactedInContest',
          [
            'uniqueContactsByTimeRange',
            {
              firstDay: ['2024-12-01T00:00:00Z', '2024-12-15T23:59:59Z'],
              secondDay: ['2024-12-16T00:00:00Z', '2024-12-31T23:59:59Z'],
            },
          ],
          ['exchange', '^[0-9]{3}$'],
          ['default', { maximumTimeDiff: 5 }],
        ],
        scoring: [
          ['timeRange', { firstDay: 1, secondDay: 2 }],
          ['bonusStations', { OA4O: 5, OA4EFJ: 3 }],
        ],
        bonus: [['default', 1]],
        tiebreaker: ['validStations', 'minimumTime'],
      },
    }

    rulesContext = getRulesContext(sampleRules)

    // Setup sample valid contacts
    validContacts = new Map<string, ValidContact[]>()
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
        score: 0,
      },
      {
        callsign: 'OA4T',
        contactedCallsign: 'OA4EFJ',
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
        score: 0,
      },
    ])

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
        score: 0,
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

  test('defaultScorer assigns the specified default score', () => {
    const validContact = validContacts.get('OA4T')![0]

    // Test with default parameter (1)
    const defaultScore = scorers.default(validContact, scoringContext)
    expect(defaultScore).toBe(1)

    // Test with custom parameter
    const customScore = scorers.default(validContact, scoringContext, 3)
    expect(customScore).toBe(3)

    // Edge case: score of 0
    const zeroScore = scorers.default(validContact, scoringContext, 0)
    expect(zeroScore).toBe(0)
  })

  test('timeRangeScorer assigns scores based on contact time range', () => {
    const validContactFirstDay = validContacts.get('OA4T')![0] // First day contact (Dec 10)
    const validContactSecondDay = validContacts.get('OA4T')![1] // Second day contact (Dec 20)

    const params = { firstDay: 1, secondDay: 2 }

    // Test first day contact
    const scoreFirstDay = scorers.timeRange(
      validContactFirstDay,
      scoringContext,
      params
    )
    expect(scoreFirstDay).toBe(1)

    // Test second day contact
    const scoreSecondDay = scorers.timeRange(
      validContactSecondDay,
      scoringContext,
      params
    )
    expect(scoreSecondDay).toBe(2)

    // Test with a different scoring scheme
    const differentParams = { firstDay: 3, secondDay: 5 }
    const newScoreFirstDay = scorers.timeRange(
      validContactFirstDay,
      scoringContext,
      differentParams
    )
    const newScoreSecondDay = scorers.timeRange(
      validContactSecondDay,
      scoringContext,
      differentParams
    )

    expect(newScoreFirstDay).toBe(3)
    expect(newScoreSecondDay).toBe(5)
  })

  test('timeRangeScorer preserves score if contact time not in any defined range', () => {
    // Create a contact outside the defined time ranges
    const outsideRangeContact: ValidContact = {
      callsign: 'OA4T',
      contactedCallsign: 'OA4P',
      date: '20230101', // Year 2023 - before our contest dates
      time: '120000',
      band: '20m',
      freq: '14.000',
      mode: 'SSB',
      exchanges: {
        rstSent: '59',
        rstRcvd: '59',
        stxString: '123',
        srxString: '456',
      },
      score: 10, // Pre-existing score
    }

    const params = { firstDay: 1, secondDay: 2 }

    // Score should remain unchanged since the contact time doesn't match any range
    const score = scorers.timeRange(outsideRangeContact, scoringContext, params)
    expect(score).toBe(10) // Should preserve the original score
  })

  test('bonusStationsScorer assigns bonus scores for specific callsigns', () => {
    // Setup test contacts
    const regularContact = validContacts.get('OA4T')![0] // OA4P

    const bonusContact: ValidContact = {
      callsign: 'OA4T',
      contactedCallsign: 'OA4O', // Bonus station
      date: '20241210',
      time: '140000',
      band: '20m',
      freq: '14.000',
      mode: 'SSB',
      exchanges: {
        rstSent: '59',
        rstRcvd: '59',
        stxString: '123',
        srxString: '456',
      },
      score: 0,
    }

    const bonusContact2: ValidContact = {
      callsign: 'OA4T',
      contactedCallsign: 'OA4EFJ', // Another bonus station
      date: '20241210',
      time: '150000',
      freq: '14.000',
      band: '20m',
      mode: 'SSB',
      exchanges: {
        rstSent: '59',
        rstRcvd: '59',
        stxString: '123',
        srxString: '456',
      },
      score: 0,
    }

    const params = { OA4O: 5, OA4EFJ: 3 }

    // Test regular contact (should get existing score)
    const regularScore = scorers.bonusStations(
      regularContact,
      scoringContext,
      params
    )
    expect(regularScore).toBe(regularContact?.score)

    // Test bonus station contact (should get 5 points)
    const bonusScore = scorers.bonusStations(
      bonusContact,
      scoringContext,
      params
    )
    expect(bonusScore).toBe(5)

    // Test another bonus station contact (should get 3 points)
    const bonusScore2 = scorers.bonusStations(
      bonusContact2,
      scoringContext,
      params
    )
    expect(bonusScore2).toBe(3)

    // Test contact with pre-existing score that isn't a bonus station
    const contactWithScore: ValidContact = {
      ...regularContact!,
      score: 2,
    }
    const preservedScore = scorers.bonusStations(
      contactWithScore,
      scoringContext,
      params
    )
    expect(preservedScore).toBe(2) // Should preserve the score
  })

  test('multiple scoring rules are applied correctly in sequence', () => {
    // Create a contact that should be affected by both timeRange and bonusStations
    const specialContact: ValidContact = {
      callsign: 'OA4T',
      contactedCallsign: 'OA4O', // Bonus station
      date: '20241220', // Second day
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
      score: 0,
    }

    // Apply rules in sequence (as the scoring engine would)
    // First timeRange - should get 2 for secondDay
    const afterTimeRange = {
      ...specialContact,
      score: scorers.timeRange(specialContact, scoringContext, {
        firstDay: 1,
        secondDay: 2,
      }),
    }
    expect(afterTimeRange.score).toBe(2)

    // Then bonusStations - should get 5 for OA4O
    const finalScore = scorers.bonusStations(afterTimeRange, scoringContext, {
      OA4O: 5,
      OA4EFJ: 3,
    })
    expect(finalScore).toBe(5)
  })

  test('scoreContacts integrates all scoring rules correctly', () => {
    // Use the sample rules and valid contacts
    const scoredContacts = scoreContacts(validContacts, rulesContext)

    // Check if all callsigns are preserved
    expect(scoredContacts.has('OA4T')).toBe(true)
    expect(scoredContacts.has('OA4P')).toBe(true)

    // Check scoring for OA4T's contacts
    const oa4tContacts = scoredContacts.get('OA4T')!

    // First contact: OA4P on firstDay (should be 1 point)
    expect(oa4tContacts[0]?.score).toBe(1)

    // Second contact: OA4EFJ on secondDay (should be 2 points base for secondDay,
    // then overridden to 3 because OA4EFJ is a bonus station)
    expect(oa4tContacts[1]?.score).toBe(3)

    // Check scoring for OA4P's contact
    const oa4pContacts = scoredContacts.get('OA4P')!

    // Only contact: OA4T on firstDay (should be 1 point)
    expect(oa4pContacts[0]?.score).toBe(1)
  })
})
