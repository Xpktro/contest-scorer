import { describe, test, expect } from 'bun:test'
import type {
  Callsign,
  ValidContact,
  ValidContacts,
  RulesContext,
  ParticipantScoringDetail,
  ContestRules,
  ContestResult,
  ContactScoringDetail,
} from '../../src/lib/types'
import { scoreContacts } from 'lib/scorer'
import { getScoreForCallsign } from '../utils/test-helpers'

// Helper function to create a valid contact for testing
const createValidContact = (
  options: Partial<ValidContact> = {}
): ValidContact => ({
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
  ...options,
})

describe('minimumContacts scoring rule', () => {
  test('participants with fewer contacts than minimum receive empty contacts array', () => {
    // Setup test data
    const callsign1 = 'OA4T'
    const callsign2 = 'OA4P'

    const validContacts = new Map<Callsign, ValidContact[]>([
      [
        callsign1,
        [
          createValidContact({
            contactedCallsign: 'OA4P',
            scoringDetailsIndex: 0,
          }),
          createValidContact({
            contactedCallsign: 'OA4Q',
            scoringDetailsIndex: 1,
          }),
          createValidContact({
            contactedCallsign: 'OA4R',
            scoringDetailsIndex: 2,
          }),
        ],
      ],
      [
        callsign2,
        [
          createValidContact({
            contactedCallsign: 'OA4T',
            scoringDetailsIndex: 0,
          }),
        ],
      ],
    ])

    const rulesContext: RulesContext = {
      contestStart: new Date(),
      contestEnd: new Date(),
      bandRanges: [],
      contestRules: {
        name: 'Test Contest',
        start: '2024-12-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z',
        rules: {
          validation: ['default'],
          scoring: [
            ['minimumContacts', 2], // Require at least 2 contacts for scoring
            'default', // Default scoring rule
          ],
          bonus: [['default', 1]],
          tiebreaker: ['validStations'],
        },
      } as ContestRules,
      timeRanges: {},
    }

    const scoringDetails: Record<
      Callsign,
      Partial<ParticipantScoringDetail>
    > = {
      [callsign1]: { contacts: [{}, {}, {}] as ContactScoringDetail[] },
      [callsign2]: { contacts: [{}] as ContactScoringDetail[] },
    }

    // Execute
    const scored = scoreContacts(validContacts, rulesContext, scoringDetails)

    // Create a ContestResult
    const result: ContestResult = {
      results: Array.from(scored.entries()).map(([callsign, contacts]) => [
        callsign,
        contacts.reduce((sum, c) => sum + c.score, 0),
      ]),
      scoringDetails: scoringDetails as any,
      missingParticipants: [],
      blacklistedCallsignsFound: [],
    }

    // Verify
    expect(scored.get(callsign1)?.length).toBe(3) // Meets minimum, contacts are scored
    expect(scored.get(callsign2)?.length).toBe(0) // Doesn't meet minimum, empty array returned

    // The participant still exists in the results but with zero score
    expect(scored.has(callsign2)).toBe(true)
    expect(getScoreForCallsign(result, callsign2)).toBe(0)

    // Participant with enough contacts gets proper score
    expect(getScoreForCallsign(result, callsign1)).toBeGreaterThan(0)
  })

  test('when no minimumContacts rule is specified, all participants are scored', () => {
    // Setup test data with same contacts but no minimumContacts rule
    const callsign1 = 'OA4T'
    const callsign2 = 'OA4P'

    const validContacts = new Map<Callsign, ValidContact[]>([
      [
        callsign1,
        [
          createValidContact({
            contactedCallsign: 'OA4P',
            scoringDetailsIndex: 0,
          }),
          createValidContact({
            contactedCallsign: 'OA4Q',
            scoringDetailsIndex: 1,
          }),
        ],
      ],
      [
        callsign2,
        [
          createValidContact({
            contactedCallsign: 'OA4T',
            scoringDetailsIndex: 0,
          }),
        ],
      ],
    ])

    const rulesContext: RulesContext = {
      contestStart: new Date(),
      contestEnd: new Date(),
      bandRanges: [],
      contestRules: {
        name: 'Test Contest',
        start: '2024-12-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z',
        rules: {
          validation: ['default'],
          scoring: [
            'default', // Only default scoring rule
          ],
          bonus: [['default', 1]],
          tiebreaker: ['validStations'],
        },
      } as ContestRules,
      timeRanges: {},
    }

    const scoringDetails: Record<
      Callsign,
      Partial<ParticipantScoringDetail>
    > = {
      [callsign1]: { contacts: [{}, {}] as ContactScoringDetail[] },
      [callsign2]: { contacts: [{}] as ContactScoringDetail[] },
    }

    // Execute
    const scored = scoreContacts(validContacts, rulesContext, scoringDetails)

    // Create a ContestResult
    const result: ContestResult = {
      results: Array.from(scored.entries()).map(([callsign, contacts]) => [
        callsign,
        contacts.reduce((sum, c) => sum + c.score, 0),
      ]),
      scoringDetails: scoringDetails as any,
      missingParticipants: [],
      blacklistedCallsignsFound: [],
    }

    // Verify
    expect(scored.get(callsign1)?.length).toBe(2)
    expect(scored.get(callsign2)?.length).toBe(1) // Should be scored despite having only 1 contact

    // Both participants should have scores
    expect(getScoreForCallsign(result, callsign1)).toBeGreaterThan(0)
    expect(getScoreForCallsign(result, callsign2)).toBeGreaterThan(0)
  })

  test('minimumContacts handles null contacts for missing participants', () => {
    // Setup test data
    const callsign1 = 'OA4T'
    const callsign2 = 'OA4P' // Missing participant

    const validContacts = new Map<Callsign, ValidContact[] | null>([
      [
        callsign1,
        [
          createValidContact({
            contactedCallsign: 'OA4P',
            scoringDetailsIndex: 0,
          }),
          createValidContact({
            contactedCallsign: 'OA4Q',
            scoringDetailsIndex: 1,
          }),
        ],
      ],
      [callsign2, null], // Missing participant
    ])

    const rulesContext: RulesContext = {
      contestStart: new Date(),
      contestEnd: new Date(),
      bandRanges: [],
      contestRules: {
        name: 'Test Contest',
        start: '2024-12-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z',
        rules: {
          validation: ['default'],
          scoring: [['minimumContacts', 1], 'default'],
          bonus: [['default', 1]],
          tiebreaker: ['validStations'],
        },
      } as ContestRules,
      timeRanges: {},
    }

    const scoringDetails: Record<
      Callsign,
      Partial<ParticipantScoringDetail>
    > = {
      [callsign1]: { contacts: [{}, {}] as ContactScoringDetail[] },
      [callsign2]: {}, // No contacts for missing participant
    }

    // Execute
    const scored = scoreContacts(
      validContacts as ValidContacts,
      rulesContext,
      scoringDetails
    )

    // Create a ContestResult
    const result: ContestResult = {
      results: Array.from(scored.entries()).map(([callsign, contacts]) => [
        callsign,
        contacts.reduce((sum, c) => sum + c.score, 0),
      ]),
      scoringDetails: scoringDetails as any,
      missingParticipants: [callsign2],
      blacklistedCallsignsFound: [],
    }

    // Verify
    expect(scored.get(callsign1)?.length).toBe(2) // Regular participant gets scored
    expect(scored.has(callsign2)).toBe(false) // Missing participant is completely ignored

    // Only the regular participant should have a score
    expect(getScoreForCallsign(result, callsign1)).toBeGreaterThan(0)
  })
})
