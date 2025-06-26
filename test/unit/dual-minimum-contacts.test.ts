import { describe, test, expect } from 'bun:test'
import type {
  Callsign,
  ValidContact,
  ContestRules,
  RulesContext,
  ParticipantScoringDetail,
  ContactScoringDetail,
} from '../../src/lib/types'
import { scoreContacts } from 'lib/scorer'
import { minimumContactsValidator } from 'lib/rules/validators'
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

describe('Dual minimumContacts Rules Architecture', () => {
  describe('Validation minimumContacts (Participant-level filtering)', () => {
    test('removes participants who do not appear in enough logs', () => {
      // Setup test data - create contacts where participants appear different numbers of times
      const validContactsMap = new Map<Callsign, ValidContact[]>([
        [
          'OA4T',
          [
            createValidContact({
              callsign: 'OA4T',
              contactedCallsign: 'OA4P',
              scoringDetailsIndex: 0,
            }),
            createValidContact({
              callsign: 'OA4T',
              contactedCallsign: 'OA4Q',
              scoringDetailsIndex: 1,
            }),
          ],
        ],
        [
          'OA4P',
          [
            createValidContact({
              callsign: 'OA4P',
              contactedCallsign: 'OA4T',
              scoringDetailsIndex: 0,
            }),
          ],
        ],
        [
          'OA4Q',
          [
            createValidContact({
              callsign: 'OA4Q',
              contactedCallsign: 'OA4T',
              scoringDetailsIndex: 0,
            }),
          ],
        ],
      ])

      const mockRulesContext: RulesContext = {
        contestRules: {
          name: 'Test Contest',
          start: '2024-12-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z',
          allowMissingParticipants: false,
          rules: {
            validation: [],
            scoring: [],
            bonus: [],
            tiebreaker: [],
          },
        },
        contestStart: new Date('2024-12-01T00:00:00Z'),
        contestEnd: new Date('2024-12-31T23:59:59Z'),
        timeRanges: {},
        bandRanges: [],
      }

      const scoringDetails: Record<
        Callsign,
        Partial<ParticipantScoringDetail>
      > = {
        OA4T: { contacts: [{}, {}] as ContactScoringDetail[] },
        OA4P: { contacts: [{}] as ContactScoringDetail[] },
        OA4Q: { contacts: [{}] as ContactScoringDetail[] },
      }

      // Create appearance counts showing how many logs each callsign appears in
      // OA4T appears in OA4P and OA4Q logs = 2 appearances
      // OA4P appears in OA4T log only = 1 appearance
      // OA4Q appears in OA4T log only = 1 appearance
      const appearanceCounts = new Map<Callsign, number>([
        ['OA4T', 2], // appears in 2 logs
        ['OA4P', 1], // appears in 1 log
        ['OA4Q', 1], // appears in 1 log
      ])

      // Test with minimum appearances = 2
      const result = minimumContactsValidator(
        validContactsMap,
        2, // minimum appearances required
        mockRulesContext,
        scoringDetails,
        new Set(),
        appearanceCounts
      )

      // Only OA4T should remain (appears in 2 logs)
      expect(result.has('OA4T')).toBe(true)
      expect(result.has('OA4P')).toBe(false) // filtered out (only 1 appearance)
      expect(result.has('OA4Q')).toBe(false) // filtered out (only 1 appearance)

      // Test with minimum appearances = 1
      const result2 = minimumContactsValidator(
        validContactsMap,
        1, // minimum appearances required
        mockRulesContext,
        scoringDetails,
        new Set(),
        appearanceCounts
      )

      // All participants should remain (all have at least 1 appearance)
      expect(result2.has('OA4T')).toBe(true)
      expect(result2.has('OA4P')).toBe(true)
      expect(result2.has('OA4Q')).toBe(true)
    })

    test('handles missing participants with allowMissingParticipants=true', () => {
      const validContactsMap = new Map<Callsign, ValidContact[]>([
        [
          'OA4T',
          [
            createValidContact({
              callsign: 'OA4T',
              contactedCallsign: 'OA4ABC', // Missing participant
            }),
          ],
        ],
      ])

      const mockRulesContext: RulesContext = {
        contestRules: {
          name: 'Test Contest',
          start: '2024-12-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z',
          allowMissingParticipants: true,
          rules: {
            validation: [],
            scoring: [],
            bonus: [],
            tiebreaker: [],
          },
        },
        contestStart: new Date('2024-12-01T00:00:00Z'),
        contestEnd: new Date('2024-12-31T23:59:59Z'),
        timeRanges: {},
        bandRanges: [],
      }

      const scoringDetails: Record<
        Callsign,
        Partial<ParticipantScoringDetail>
      > = {
        OA4T: { contacts: [{}] as ContactScoringDetail[] },
      }

      // OA4ABC appears in OA4T log but didn't submit = missing participant
      const appearanceCounts = new Map<Callsign, number>([
        ['OA4T', 0], // OA4T doesn't appear in other logs
        ['OA4ABC', 1], // OA4ABC appears in OA4T log
      ])

      const missingParticipants = new Set(['OA4ABC'])

      const result = minimumContactsValidator(
        validContactsMap,
        1,
        mockRulesContext,
        scoringDetails,
        missingParticipants,
        appearanceCounts
      )

      // OA4ABC should be added as missing participant with null contacts
      expect(result.has('OA4ABC')).toBe(true)
      expect(result.get('OA4ABC')).toBeNull()
    })
  })

  describe('Scoring minimumContacts (Contact-level point filtering)', () => {
    test('disables points for contacts with stations that do not meet appearance threshold', () => {
      const callsign1 = 'OA4T'
      const callsign2 = 'OA4P'

      const validContacts = new Map<Callsign, ValidContact[]>([
        [
          callsign1,
          [
            createValidContact({
              callsign: callsign1,
              contactedCallsign: 'OA4Q', // Appears in multiple logs
              scoringDetailsIndex: 0,
            }),
            createValidContact({
              callsign: callsign1,
              contactedCallsign: 'OA4R', // Appears in only one log
              scoringDetailsIndex: 1,
            }),
          ],
        ],
        [
          callsign2,
          [
            createValidContact({
              callsign: callsign2,
              contactedCallsign: 'OA4Q', // Appears in multiple logs
              scoringDetailsIndex: 0,
            }),
            createValidContact({
              callsign: callsign2,
              contactedCallsign: 'OA4S', // Add another contact to meet participant minimum
              scoringDetailsIndex: 1,
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
              ['minimumContacts', 2], // Require 2 appearances for contact to award points
              'default',
            ],
            bonus: [['default', 1]],
            tiebreaker: ['validStations'],
          },
        } as any,
        timeRanges: {},
      }

      const scoringDetails: Record<
        Callsign,
        Partial<ParticipantScoringDetail>
      > = {
        [callsign1]: { contacts: [{}, {}] as ContactScoringDetail[] },
        [callsign2]: { contacts: [{}, {}] as ContactScoringDetail[] },
      }

      // Appearance counts: OA4Q appears in both logs, OA4R appears in only one, OA4S appears in only one
      const appearanceCounts = new Map<Callsign, number>([
        ['OA4Q', 2], // appears in OA4T and OA4P logs
        ['OA4R', 1], // appears in OA4T log only
        ['OA4S', 1], // appears in OA4P log only
      ])

      const scored = scoreContacts(
        validContacts,
        rulesContext,
        scoringDetails,
        appearanceCounts
      )

      // Check scoring details to see which contacts received points
      const callsign1Details = scoringDetails[callsign1]?.contacts
      const callsign2Details = scoringDetails[callsign2]?.contacts

      // OA4T's contact with OA4Q should receive points (OA4Q appears 2+ times)
      expect(callsign1Details?.[0]?.givenScore).toBe(1)
      expect(callsign1Details?.[0]?.scoreRule).toBe('default')

      // OA4T's contact with OA4R should not receive points (OA4R appears only once)
      expect(callsign1Details?.[1]?.givenScore).toBe(0)
      expect(callsign1Details?.[1]?.scoreRule).toBe('minimumContacts')

      // OA4P's contact with OA4Q should receive points (OA4Q appears 2+ times)
      expect(callsign2Details?.[0]?.givenScore).toBe(1)
      expect(callsign2Details?.[0]?.scoreRule).toBe('default')

      // OA4P's contact with OA4S should not receive points (OA4S appears only once)
      expect(callsign2Details?.[1]?.givenScore).toBe(0)
      expect(callsign2Details?.[1]?.scoreRule).toBe('minimumContacts')
    })

    test('works correctly when no minimumContacts scoring rule is specified', () => {
      const callsign1 = 'OA4T'

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
            scoring: ['default'], // No minimumContacts rule
            bonus: [['default', 1]],
            tiebreaker: ['validStations'],
          },
        } as any,
        timeRanges: {},
      }

      const scoringDetails: Record<
        Callsign,
        Partial<ParticipantScoringDetail>
      > = {
        [callsign1]: {
          contacts: [
            {
              givenScore: 0,
              scoreRule: null,
              invalidValidationRule: null,
            } as ContactScoringDetail,
            {
              givenScore: 0,
              scoreRule: null,
              invalidValidationRule: null,
            } as ContactScoringDetail,
          ],
        },
      }

      // Even though stations have low appearance counts, no filtering should occur
      const appearanceCounts = new Map<Callsign, number>([
        ['OA4P', 1],
        ['OA4Q', 1],
      ])

      const scored = scoreContacts(
        validContacts,
        rulesContext,
        scoringDetails,
        appearanceCounts
      )

      // Both contacts should receive points since no minimumContacts scoring rule
      const details = scoringDetails[callsign1]?.contacts
      expect(details?.[0]?.givenScore).toBe(1)
      expect(details?.[1]?.givenScore).toBe(1)
    })
  })

  describe('Appearance Counting Logic', () => {
    test('counts each callsign once per submission regardless of multiple contacts', () => {
      // This test verifies that appearance counting is based on unique submissions
      // A callsign that appears multiple times in the same log should only count as 1 appearance

      const validContactsMap = new Map<Callsign, ValidContact[]>([
        [
          'OA4T',
          [
            createValidContact({
              callsign: 'OA4T',
              contactedCallsign: 'OA4P', // OA4P appears multiple times in OA4T's log
            }),
            createValidContact({
              callsign: 'OA4T',
              contactedCallsign: 'OA4P', // Same station, different contact
            }),
            createValidContact({
              callsign: 'OA4T',
              contactedCallsign: 'OA4Q',
            }),
          ],
        ],
        [
          'OA4EFJ',
          [
            createValidContact({
              callsign: 'OA4EFJ',
              contactedCallsign: 'OA4P', // OA4P also appears in OA4EFJ's log
            }),
            createValidContact({
              callsign: 'OA4EFJ',
              contactedCallsign: 'OA4Q',
            }),
          ],
        ],
      ])

      // Simulate the appearance counting logic from validator.ts
      const appearanceCounts = new Map<Callsign, number>()

      for (const contacts of validContactsMap.values()) {
        const localAppearances = new Set<Callsign>()
        for (const contact of contacts) {
          const contactedCallsign = contact.contactedCallsign
          if (localAppearances.has(contactedCallsign)) continue // Skip duplicates within same log
          const appearances = (appearanceCounts.get(contactedCallsign) || 0) + 1
          appearanceCounts.set(contactedCallsign, appearances)
          localAppearances.add(contactedCallsign)
        }
      }

      // Verify appearance counts
      expect(appearanceCounts.get('OA4P')).toBe(2) // Appears in OA4T and OA4EFJ logs (counted once each)
      expect(appearanceCounts.get('OA4Q')).toBe(2) // Appears in OA4T and OA4EFJ logs
    })
  })

  describe('Integration: Both Rules Working Together', () => {
    test('validation minimumContacts filters participants, then scoring minimumContacts filters contacts', () => {
      // Scenario:
      // - OA4T submits log with contacts to OA4P, OA4Q
      // - OA4P submits log with contact to OA4T
      // - OA4Q does NOT submit log
      // - OA4R submits log with contact to OA4T
      // Appearance counts: OA4T=2, OA4P=1, OA4Q=1, OA4R=0
      // With validation minimum=2: Only OA4T remains as participant
      // With scoring minimum=2: OA4T's contacts only score if contacted station appears 2+ times

      const validContactsMap = new Map<Callsign, ValidContact[]>([
        [
          'OA4T',
          [
            createValidContact({
              callsign: 'OA4T',
              contactedCallsign: 'OA4P',
              scoringDetailsIndex: 0,
            }),
            createValidContact({
              callsign: 'OA4T',
              contactedCallsign: 'OA4Q',
              scoringDetailsIndex: 1,
            }),
          ],
        ],
        [
          'OA4P',
          [
            createValidContact({
              callsign: 'OA4P',
              contactedCallsign: 'OA4T',
              scoringDetailsIndex: 0,
            }),
          ],
        ],
        [
          'OA4R',
          [
            createValidContact({
              callsign: 'OA4R',
              contactedCallsign: 'OA4T',
              scoringDetailsIndex: 0,
            }),
          ],
        ],
      ])

      const mockRulesContext: RulesContext = {
        contestRules: {
          name: 'Test Contest',
          start: '2024-12-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z',
          allowMissingParticipants: false,
          rules: {
            validation: [['minimumContacts', 2]], // Participant must appear in 2+ logs
            scoring: [['minimumContacts', 2], 'default'], // Contact must be with station appearing in 2+ logs
            bonus: [],
            tiebreaker: [],
          },
        },
        contestStart: new Date('2024-12-01T00:00:00Z'),
        contestEnd: new Date('2024-12-31T23:59:59Z'),
        timeRanges: {},
        bandRanges: [],
      }

      const scoringDetails: Record<
        Callsign,
        Partial<ParticipantScoringDetail>
      > = {
        OA4T: { contacts: [{}, {}] as ContactScoringDetail[] },
        OA4P: { contacts: [{}] as ContactScoringDetail[] },
        OA4R: { contacts: [{}] as ContactScoringDetail[] },
      }

      const appearanceCounts = new Map<Callsign, number>([
        ['OA4T', 2], // appears in OA4P and OA4R logs
        ['OA4P', 1], // appears in OA4T log only
        ['OA4Q', 1], // appears in OA4T log only
        ['OA4R', 0], // doesn't appear in other logs
      ])

      // Apply validation minimumContacts filter
      const validatedParticipants = minimumContactsValidator(
        validContactsMap,
        2,
        mockRulesContext,
        scoringDetails,
        new Set(),
        appearanceCounts
      )

      // Only OA4T should remain (appears in 2+ logs)
      expect(validatedParticipants.has('OA4T')).toBe(true)
      expect(validatedParticipants.has('OA4P')).toBe(false)
      expect(validatedParticipants.has('OA4R')).toBe(false)

      // Apply scoring to remaining participants
      const scoringDetailsForScoring = {
        OA4T: {
          contacts: [
            {
              givenScore: 0,
              scoreRule: null,
              invalidValidationRule: null,
            } as ContactScoringDetail,
            {
              givenScore: 0,
              scoreRule: null,
              invalidValidationRule: null,
            } as ContactScoringDetail,
          ],
        },
      }

      const scored = scoreContacts(
        validatedParticipants,
        mockRulesContext,
        scoringDetailsForScoring,
        appearanceCounts
      )

      // Check OA4T's scoring details from the scoring object used in scoreContacts
      const oa4tDetails = scoringDetailsForScoring['OA4T']?.contacts

      // OA4T's contact with OA4P should NOT score (OA4P appears only once)
      expect(oa4tDetails?.[0]?.givenScore).toBe(0)
      expect(oa4tDetails?.[0]?.scoreRule).toBe('minimumContacts')

      // OA4T's contact with OA4Q should NOT score (OA4Q appears only once)
      expect(oa4tDetails?.[1]?.givenScore).toBe(0)
      expect(oa4tDetails?.[1]?.scoreRule).toBe('minimumContacts')
    })
  })
})
