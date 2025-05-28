import { describe, test, expect, beforeEach } from 'bun:test'
import type {
  ContestRules,
  ScoringContext,
  ValidContact,
  RulesContext,
  ContestResult,
} from '../../src/lib/types'
import { scorers } from 'lib/rules/scorers'
import { scoreContacts } from 'lib/scorer'
import { getRulesContext } from 'lib/precalculate'
import {
  getScoreForCallsign,
  getScoringDetailsForCallsign,
} from '../utils/test-helpers'

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
        scoringDetailsIndex: 0,
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
        scoringDetailsIndex: 1,
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
        scoringDetailsIndex: 0,
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
      scoringDetailsIndex: 0,
    }

    const params = { firstDay: 1, secondDay: 2 }

    // Score should remain unchanged since the contact time doesn't match any range
    const score = scorers.timeRange(outsideRangeContact, scoringContext, params)
    expect(score).toBe(10) // Should preserve the original score
  })

  test('bonusStationsScorer assigns bonus scores for specific callsigns', () => {
    // Setup test contacts
    const testContacts = new Map<string, ValidContact[]>()

    // Create a regular contact with normal participant
    const regularContact: ValidContact = {
      callsign: 'OA4T',
      contactedCallsign: 'OA4P',
      date: '20241210',
      time: '130000',
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
      scoringDetailsIndex: 0,
    }

    // Create bonus station contacts
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
      scoringDetailsIndex: 1,
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
      scoringDetailsIndex: 2,
    }

    testContacts.set('OA4T', [regularContact, bonusContact, bonusContact2])

    // Create scoring details structure
    const scoringDetails = {
      OA4T: {
        contacts: Array(3).fill({ score: 0, scoreRule: null, givenScore: 0 }),
        bonusRuleApplied: null,
        givenBonus: 0,
        hasMinimumAppearances: true,
      },
    }

    // Score the contacts
    const scoredContacts = scoreContacts(
      testContacts,
      rulesContext,
      scoringDetails
    )

    // Create a ContestResult
    const result: ContestResult = {
      results: Array.from(scoredContacts.entries()).map(
        ([callsign, contacts]) => [
          callsign,
          contacts.reduce((sum, c) => sum + c.score, 0),
        ]
      ),
      scoringDetails,
      missingParticipants: [],
      blacklistedCallsignsFound: [],
    }

    // Verify individual contact scores
    const contacts = scoredContacts.get('OA4T')
    expect(contacts).toBeDefined()
    if (!contacts) return

    expect(contacts[0]?.score).toBe(1) // Regular contact worth 1 point
    expect(contacts[1]?.score).toBe(5) // OA4O bonus station worth 5 points
    expect(contacts[2]?.score).toBe(3) // OA4EFJ bonus station worth 3 points

    // Total score should be 9 points
    expect(getScoreForCallsign(result, 'OA4T')).toBe(9)
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
      scoringDetailsIndex: 0,
    }

    // Create test contacts map and scoring details
    const testContacts = new Map<string, ValidContact[]>([
      ['OA4T', [specialContact]],
    ])

    // Create scoring details structure
    const scoringDetails = {
      OA4T: {
        contacts: Array(1).fill({ score: 0, scoreRule: null, givenScore: 0 }),
        bonusRuleApplied: null,
        givenBonus: 0,
        hasMinimumAppearances: true,
      },
    }

    // Score the contacts
    const scoredContacts = scoreContacts(
      testContacts,
      rulesContext,
      scoringDetails
    )

    // Create a ContestResult for testing
    const result: ContestResult = {
      results: Array.from(scoredContacts.entries()).map(
        ([callsign, contacts]) => [
          callsign,
          contacts.reduce((sum, c) => sum + c.score, 0),
        ]
      ),
      scoringDetails,
      missingParticipants: [],
      blacklistedCallsignsFound: [],
    }

    // Check scoring
    const score = getScoreForCallsign(result, 'OA4T')
    expect(score).toBe(5) // 2 points for secondDay, then overwritten to 5 for OA4O bonus

    // Check scoring details
    const details = getScoringDetailsForCallsign(result, 'OA4T')
    expect(details).toBeDefined()
    if (!details) return

    const contact = details.contacts[0]
    expect(contact).toBeDefined()
    if (!contact) return

    expect(contact.scoreRule).toBe('bonusStations')
    expect(contact.givenScore).toBe(5)
  })

  test('scoreContacts integrates all scoring rules correctly', () => {
    // Create scoring details structure
    const scoringDetails = {
      OA4T: {
        contacts: Array(2).fill({ score: 0, scoreRule: null, givenScore: 0 }),
        bonusRuleApplied: null,
        givenBonus: 0,
        hasMinimumAppearances: true,
      },
      OA4P: {
        contacts: Array(1).fill({ score: 0, scoreRule: null, givenScore: 0 }),
        bonusRuleApplied: null,
        givenBonus: 0,
        hasMinimumAppearances: true,
      },
    }

    // Score the contacts
    const scoredContacts = scoreContacts(
      validContacts,
      rulesContext,
      scoringDetails
    )

    // Create a ContestResult for testing
    const result: ContestResult = {
      results: Array.from(scoredContacts.entries()).map(
        ([callsign, contacts]) => [
          callsign,
          contacts.reduce((sum, c) => sum + c.score, 0),
        ]
      ),
      scoringDetails,
      missingParticipants: [],
      blacklistedCallsignsFound: [],
    }

    // Check if all callsigns are preserved
    const oa4tContacts = scoredContacts.get('OA4T')
    const oa4pContacts = scoredContacts.get('OA4P')

    expect(oa4tContacts).toBeDefined()
    expect(oa4pContacts).toBeDefined()

    if (!oa4tContacts || !oa4pContacts) return

    // First contact: OA4P on firstDay (should be 1 point)
    expect(oa4tContacts[0]?.score).toBe(1)

    // Second contact: OA4EFJ on secondDay (should be 2 points base for secondDay,
    // then overridden to 3 because OA4EFJ is a bonus station)
    expect(oa4tContacts[1]?.score).toBe(3)

    // Check scoring for OA4P's contact
    // Only contact: OA4T on firstDay (should be 1 point)
    expect(oa4pContacts[0]?.score).toBe(1)

    // Check scoring details
    const oa4tDetails = getScoringDetailsForCallsign(result, 'OA4T')
    const oa4pDetails = getScoringDetailsForCallsign(result, 'OA4P')

    expect(oa4tDetails).toBeDefined()
    expect(oa4pDetails).toBeDefined()
  })

  test('timeRange scorer correctly assigns different scores based on time periods', () => {
    const outsideRangeContact: ValidContact = {
      callsign: 'TEST1',
      contactedCallsign: 'TEST2',
      date: '20241101', // Before contest
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
      score: 0,
      scoringDetailsIndex: 0,
    }

    // Create a new map with just the test contacts
    const testContacts = new Map<string, ValidContact[]>()
    testContacts.set('TEST1', [outsideRangeContact])

    // Create empty scoring details object
    const scoringDetails = {
      TEST1: {
        contacts: [],
        bonusRuleApplied: null,
        givenBonus: 0,
        hasMinimumAppearances: true,
      },
    }

    // Score the contacts
    const scoredContacts = scoreContacts(
      testContacts,
      rulesContext,
      scoringDetails
    )

    // The result should be like a ContestResult
    const result: ContestResult = {
      results: Array.from(scoredContacts.entries()).map(
        ([callsign, contacts]) => [
          callsign,
          contacts.reduce((sum, c) => sum + c.score, 0),
        ]
      ),
      scoringDetails,
      missingParticipants: [],
      blacklistedCallsignsFound: [],
    }

    // Check scoring
    expect(getScoreForCallsign(result, 'TEST1')).toBe(0)
    expect(
      getScoringDetailsForCallsign(result, 'TEST1')?.hasMinimumAppearances
    ).toBe(true)
  })
})
