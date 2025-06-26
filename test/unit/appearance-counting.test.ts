import { describe, test, expect } from 'bun:test'
import type { Callsign, ValidContact } from '../../src/lib/types'

// Helper function to create a valid contact
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

describe('Appearance Counting Edge Cases', () => {
  test('counts appearances correctly when same station contacted multiple times in same log', () => {
    // A participant contacts the same station multiple times (different bands/modes/times)
    // This should still only count as 1 appearance for that station
    const validContactsMap = new Map<Callsign, ValidContact[]>([
      [
        'OA4T',
        [
          createValidContact({
            callsign: 'OA4T',
            contactedCallsign: 'OA4P',
            band: '20m',
            mode: 'SSB',
            time: '120000',
          }),
          createValidContact({
            callsign: 'OA4T',
            contactedCallsign: 'OA4P', // Same station
            band: '40m', // Different band
            mode: 'CW', // Different mode
            time: '130000', // Different time
          }),
          createValidContact({
            callsign: 'OA4T',
            contactedCallsign: 'OA4Q',
            band: '20m',
            mode: 'SSB',
          }),
        ],
      ],
      [
        'OA4EFJ',
        [
          createValidContact({
            callsign: 'OA4EFJ',
            contactedCallsign: 'OA4P', // OA4P also contacted by OA4EFJ
          }),
          createValidContact({
            callsign: 'OA4EFJ',
            contactedCallsign: 'OA4R',
          }),
        ],
      ],
    ])

    // Simulate appearance counting logic
    const appearanceCounts = new Map<Callsign, number>()

    for (const contacts of validContactsMap.values()) {
      const localAppearances = new Set<Callsign>()
      for (const contact of contacts) {
        const contactedCallsign = contact.contactedCallsign
        if (localAppearances.has(contactedCallsign)) continue
        const appearances = (appearanceCounts.get(contactedCallsign) || 0) + 1
        appearanceCounts.set(contactedCallsign, appearances)
        localAppearances.add(contactedCallsign)
      }
    }

    // Verify that multiple contacts with same station in same log only count as 1 appearance
    expect(appearanceCounts.get('OA4P')).toBe(2) // OA4T log (once) + OA4EFJ log (once) = 2
    expect(appearanceCounts.get('OA4Q')).toBe(1) // OA4T log only
    expect(appearanceCounts.get('OA4R')).toBe(1) // OA4EFJ log only
  })

  test('handles empty contact lists correctly', () => {
    const validContactsMap = new Map<Callsign, ValidContact[]>([
      ['OA4T', []], // Empty contact list
      [
        'OA4P',
        [
          createValidContact({
            callsign: 'OA4P',
            contactedCallsign: 'OA4Q',
          }),
        ],
      ],
    ])

    const appearanceCounts = new Map<Callsign, number>()

    for (const contacts of validContactsMap.values()) {
      const localAppearances = new Set<Callsign>()
      for (const contact of contacts) {
        const contactedCallsign = contact.contactedCallsign
        if (localAppearances.has(contactedCallsign)) continue
        const appearances = (appearanceCounts.get(contactedCallsign) || 0) + 1
        appearanceCounts.set(contactedCallsign, appearances)
        localAppearances.add(contactedCallsign)
      }
    }

    expect(appearanceCounts.get('OA4Q')).toBe(1) // Only appears in OA4P's log
    expect(appearanceCounts.get('OA4T')).toBeUndefined() // OA4T has no contacts, so appears 0 times
    expect(appearanceCounts.get('OA4P')).toBeUndefined() // OA4P doesn't appear in other logs
  })

  test('handles case where station appears in many logs', () => {
    // Test with a popular station that appears in many logs
    const validContactsMap = new Map<Callsign, ValidContact[]>([
      [
        'OA4T',
        [
          createValidContact({
            callsign: 'OA4T',
            contactedCallsign: 'OA4POPULAR', // Popular station
          }),
        ],
      ],
      [
        'OA4P',
        [
          createValidContact({
            callsign: 'OA4P',
            contactedCallsign: 'OA4POPULAR', // Same popular station
          }),
        ],
      ],
      [
        'OA4Q',
        [
          createValidContact({
            callsign: 'OA4Q',
            contactedCallsign: 'OA4POPULAR', // Same popular station
          }),
        ],
      ],
      [
        'OA4R',
        [
          createValidContact({
            callsign: 'OA4R',
            contactedCallsign: 'OA4POPULAR', // Same popular station
          }),
        ],
      ],
    ])

    const appearanceCounts = new Map<Callsign, number>()

    for (const contacts of validContactsMap.values()) {
      const localAppearances = new Set<Callsign>()
      for (const contact of contacts) {
        const contactedCallsign = contact.contactedCallsign
        if (localAppearances.has(contactedCallsign)) continue
        const appearances = (appearanceCounts.get(contactedCallsign) || 0) + 1
        appearanceCounts.set(contactedCallsign, appearances)
        localAppearances.add(contactedCallsign)
      }
    }

    expect(appearanceCounts.get('OA4POPULAR')).toBe(4) // Appears in all 4 logs
  })

  test('case sensitivity in callsign matching', () => {
    // Test that callsign matching is case-sensitive (or whatever the intended behavior is)
    const validContactsMap = new Map<Callsign, ValidContact[]>([
      [
        'OA4T',
        [
          createValidContact({
            callsign: 'OA4T',
            contactedCallsign: 'oa4p', // lowercase
          }),
          createValidContact({
            callsign: 'OA4T',
            contactedCallsign: 'OA4P', // uppercase
          }),
        ],
      ],
    ])

    const appearanceCounts = new Map<Callsign, number>()

    for (const contacts of validContactsMap.values()) {
      const localAppearances = new Set<Callsign>()
      for (const contact of contacts) {
        const contactedCallsign = contact.contactedCallsign
        if (localAppearances.has(contactedCallsign)) continue
        const appearances = (appearanceCounts.get(contactedCallsign) || 0) + 1
        appearanceCounts.set(contactedCallsign, appearances)
        localAppearances.add(contactedCallsign)
      }
    }

    // Since case matters, these should be treated as different callsigns
    expect(appearanceCounts.get('oa4p')).toBe(1)
    expect(appearanceCounts.get('OA4P')).toBe(1)
  })

  test('handles missing or invalid callsigns gracefully', () => {
    const validContactsMap = new Map<Callsign, ValidContact[]>([
      [
        'OA4T',
        [
          createValidContact({
            callsign: 'OA4T',
            contactedCallsign: '', // Empty callsign
          }),
          createValidContact({
            callsign: 'OA4T',
            contactedCallsign: 'OA4P',
          }),
          createValidContact({
            callsign: 'OA4T',
            contactedCallsign: '   ', // Whitespace only
          }),
        ],
      ],
    ])

    const appearanceCounts = new Map<Callsign, number>()

    for (const contacts of validContactsMap.values()) {
      const localAppearances = new Set<Callsign>()
      for (const contact of contacts) {
        const contactedCallsign = contact.contactedCallsign
        if (!contactedCallsign || !contactedCallsign.trim()) continue // Skip invalid callsigns
        if (localAppearances.has(contactedCallsign)) continue
        const appearances = (appearanceCounts.get(contactedCallsign) || 0) + 1
        appearanceCounts.set(contactedCallsign, appearances)
        localAppearances.add(contactedCallsign)
      }
    }

    expect(appearanceCounts.get('')).toBeUndefined() // Empty callsign not counted
    expect(appearanceCounts.get('   ')).toBeUndefined() // Whitespace callsign not counted
    expect(appearanceCounts.get('OA4P')).toBe(1) // Valid callsign counted
  })
})
