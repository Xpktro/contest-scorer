import { describe, test, expect, beforeEach } from 'bun:test'
import type {
  Callsign,
  ContestRules,
  ScoringResult,
  ValidContact,
} from '../../src/lib/types'
import { tiebreakers } from 'lib/rules/tiebreakers'
import { applyTiebreakers } from 'lib/tiebreaker'

describe('Tiebreakers', () => {
  let scoredContacts: Map<Callsign, ValidContact[]>
  let results: ScoringResult[]

  beforeEach(() => {
    // Setup sample valid contacts
    scoredContacts = new Map<Callsign, ValidContact[]>()

    // OA4T has 2 contacts with 2 different stations
    scoredContacts.set('OA4T', [
      {
        callsign: 'OA4T',
        contactedCallsign: 'OA4P',
        date: '20241210',
        time: '120000', // First contact at 12:00
        freq: '14.000',
        band: '20m',
        mode: 'SSB',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1,
        scoringDetailsIndex: 0,
      },
      {
        callsign: 'OA4T',
        contactedCallsign: 'OA4EFJ',
        date: '20241210',
        time: '140000', // Last contact at 14:00 (2 hours span)
        mode: 'CW',
        freq: '14.000',
        band: '20m',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 2,
        scoringDetailsIndex: 1,
      },
    ])

    // OA4P has 3 contacts with 2 different stations (one duplicate)
    scoredContacts.set('OA4P', [
      {
        callsign: 'OA4P',
        contactedCallsign: 'OA4T',
        date: '20241210',
        time: '120000', // First contact at 12:00
        mode: 'SSB',
        freq: '14.000',
        band: '20m',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1,
        scoringDetailsIndex: 0,
      },
      {
        callsign: 'OA4P',
        contactedCallsign: 'OA4EFJ',
        date: '20241210',
        time: '123000', // Second contact at 12:30
        mode: 'CW',
        freq: '14.000',
        band: '20m',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1,
        scoringDetailsIndex: 1,
      },
      {
        callsign: 'OA4P',
        contactedCallsign: 'OA4T', // Duplicate station
        date: '20241210',
        time: '130000', // Last contact at 13:00 (1 hour span)
        mode: 'CW',
        freq: '14.000',
        band: '20m',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1,
        scoringDetailsIndex: 2,
      },
    ])

    // OA4EFJ has 3 contacts with 3 different stations
    scoredContacts.set('OA4EFJ', [
      {
        callsign: 'OA4EFJ',
        contactedCallsign: 'OA4T',
        date: '20241210',
        time: '140000', // First contact at 14:00
        mode: 'CW',
        freq: '14.000',
        band: '20m',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1,
        scoringDetailsIndex: 0,
      },
      {
        callsign: 'OA4EFJ',
        contactedCallsign: 'OA4P',
        date: '20241210',
        time: '123000', // Second contact at 12:30 (not chronological)
        mode: 'CW',
        freq: '14.000',
        band: '20m',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1,
        scoringDetailsIndex: 1,
      },
      {
        callsign: 'OA4EFJ',
        contactedCallsign: 'OA4O', // Third station
        date: '20241210',
        time: '160000', // Last contact at 16:00 (3.5 hours span max)
        mode: 'SSB',
        freq: '14.000',
        band: '20m',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1,
        scoringDetailsIndex: 2,
      },
    ])

    // All stations have same score of 3 for tie-breaking tests
    results = [
      ['OA4T', 3],
      ['OA4P', 3],
      ['OA4EFJ', 3],
    ]
  })

  test('defaultTiebreaker returns 0 (no change)', () => {
    const result = tiebreakers.default('OA4T', 'OA4P', scoredContacts)
    expect(result).toBe(0)
  })

  test('validStationsTiebreaker ranks by number of unique stations', () => {
    // OA4EFJ has 3 unique stations
    // OA4T has 2 unique stations
    // OA4P has 2 unique stations

    // OA4EFJ should be ranked higher than OA4T
    expect(tiebreakers.validStations('OA4EFJ', 'OA4T', scoredContacts)).toBe(-1)

    // OA4T should be ranked lower than OA4EFJ
    expect(tiebreakers.validStations('OA4T', 'OA4EFJ', scoredContacts)).toBe(1)

    // OA4T and OA4P have the same number of unique stations, so should be tied
    expect(tiebreakers.validStations('OA4T', 'OA4P', scoredContacts)).toBe(0)
  })

  test('minimumTimeTiebreaker ranks by time span (less is better)', () => {
    // OA4P has 1 hour span
    // OA4T has 2 hours span
    // OA4EFJ has 3.5 hours span

    // OA4P should be ranked higher than OA4T
    expect(tiebreakers.minimumTime('OA4P', 'OA4T', scoredContacts) < 0).toBe(
      true
    )

    // OA4T should be ranked higher than OA4EFJ
    expect(tiebreakers.minimumTime('OA4T', 'OA4EFJ', scoredContacts) < 0).toBe(
      true
    )

    // OA4EFJ should be ranked lower than OA4P
    expect(tiebreakers.minimumTime('OA4EFJ', 'OA4P', scoredContacts) > 0).toBe(
      true
    )
  })

  test('minimumTimeTiebreaker handles edge cases correctly', () => {
    // Create a map with contacts that have edge cases
    const edgeCaseMap = new Map<Callsign, ValidContact[]>()

    // One contact only - no time span
    edgeCaseMap.set('OA4X', [
      {
        callsign: 'OA4X',
        contactedCallsign: 'OA4T',
        date: '20241210',
        time: '120000',
        freq: '14.000',
        mode: 'SSB',
        band: '20m',
        exchanges: {
          rstSent: '59',
          rstRcvd: '59',
          stxString: '123',
          srxString: '456',
        },
        score: 1,
        scoringDetailsIndex: 0,
      },
    ])

    // Empty contacts
    edgeCaseMap.set('OA4Y', [])

    // In the implementation, when both have 0 or 1 contacts, it returns 0 (no difference)
    expect(tiebreakers.minimumTime('OA4X', 'OA4Y', edgeCaseMap)).toBe(0)
    expect(tiebreakers.minimumTime('OA4Y', 'OA4X', edgeCaseMap)).toBe(0)

    // When comparing a station with 1 contact to a station with 2+ contacts
    expect(tiebreakers.minimumTime('OA4X', 'OA4T', scoredContacts)).toBe(1) // OA4T is better
    expect(tiebreakers.minimumTime('OA4T', 'OA4X', scoredContacts)).toBe(-1) // OA4T is better
  })

  test('applyTiebreakers applies single tiebreaker correctly', () => {
    const rules: ContestRules = {
      name: 'Test Contest',
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z',
      rules: {
        validation: ['timeRange'],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'], // Only using validStations tiebreaker
      },
    }

    const tieBrokenResults = applyTiebreakers(results, scoredContacts, rules)

    // OA4EFJ should be first (3 unique stations)
    expect(tieBrokenResults[0]?.[0]).toBe('OA4EFJ')

    // OA4T and OA4P should remain in their original order since they're tied
    expect(tieBrokenResults[1]?.[0]).toBe('OA4T')
    expect(tieBrokenResults[2]?.[0]).toBe('OA4P')
  })

  test('applyTiebreakers applies multiple tiebreakers in order', () => {
    const rules: ContestRules = {
      name: 'Test Contest',
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z',
      rules: {
        validation: ['timeRange'],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations', 'minimumTime'], // Apply both tiebreakers
      },
    }

    const tieBrokenResults = applyTiebreakers(results, scoredContacts, rules)

    // OA4EFJ should be first (3 unique stations)
    expect(tieBrokenResults[0]?.[0]).toBe('OA4EFJ')

    // OA4T and OA4P are tied for unique stations, but OA4P has shorter time span
    // So OA4P should be second
    expect(tieBrokenResults[1]?.[0]).toBe('OA4P')

    // OA4T should be third
    expect(tieBrokenResults[2]?.[0]).toBe('OA4T')
  })

  test('applyTiebreakers handles non-ties correctly', () => {
    // Create results with different scores (no ties)
    const nonTiedResults: ScoringResult[] = [
      ['OA4T', 5],
      ['OA4P', 3],
      ['OA4EFJ', 7],
    ]

    const rules: ContestRules = {
      name: 'Test Contest',
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z',
      rules: {
        validation: ['timeRange'],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations', 'minimumTime'],
      },
    }

    const sortedResults = applyTiebreakers(
      nonTiedResults,
      scoredContacts,
      rules
    )

    // Should be sorted by score only (no tiebreakers needed)
    expect(sortedResults[0]?.[0]).toBe('OA4EFJ') // 7 points
    expect(sortedResults[1]?.[0]).toBe('OA4T') // 5 points
    expect(sortedResults[2]?.[0]).toBe('OA4P') // 3 points
  })

  test('applyTiebreakers handles empty tiebreaker rules', () => {
    const rules: ContestRules = {
      name: 'Test Contest',
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z',
      rules: {
        validation: ['timeRange'],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: [], // No tiebreakers specified
      },
    }

    const sortedResults = applyTiebreakers(results, scoredContacts, rules)

    // Should preserve the original order for tied scores
    expect(sortedResults[0]?.[0]).toBe('OA4T')
    expect(sortedResults[1]?.[0]).toBe('OA4P')
    expect(sortedResults[2]?.[0]).toBe('OA4EFJ')
  })
})
