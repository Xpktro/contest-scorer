import type { Callsign, TieBreakerRule, ValidContact } from '../types'
import { parseDateTime } from 'utils'

// Default tiebreaker - no sorting applied as score sorting is assumed to be done already
export const defaultTiebreaker = (): number => {
  return 0 // No sorting applied
}

// Sort by number of unique stations contacted
export const validStationsTiebreaker = (
  a: Callsign,
  b: Callsign,
  scoredContacts: Map<Callsign, ValidContact[]>
): number => {
  const contactsA = scoredContacts.get(a) || []
  const contactsB = scoredContacts.get(b) || []

  const uniqueStationsA = new Set(contactsA.map(c => c.contactedCallsign)).size
  const uniqueStationsB = new Set(contactsB.map(c => c.contactedCallsign)).size

  // Higher number of stations comes first
  return uniqueStationsB - uniqueStationsA
}

// Sort by time between first and last contact
export const minimumTimeTiebreaker = (
  a: Callsign,
  b: Callsign,
  scoredContacts: Map<Callsign, ValidContact[]>
): number => {
  // Sort by time between first and last contact (less is better)
  const contactsA = scoredContacts.get(a) || []
  const contactsB = scoredContacts.get(b) || []

  if (contactsA.length <= 1 && contactsB.length <= 1) {
    return 0 // Both have 0 or 1 contacts, no difference
  }

  if (contactsA.length <= 1) return 1 // B is better
  if (contactsB.length <= 1) return -1 // A is better

  // Calculate time span for A
  const datesA = contactsA.map(contact =>
    parseDateTime(contact.date, contact.time)
  )
  const firstA = new Date(Math.min(...datesA.map(d => d.getTime())))
  const lastA = new Date(Math.max(...datesA.map(d => d.getTime())))
  const timeSpanA = lastA.getTime() - firstA.getTime()

  // Calculate time span for B
  const datesB = contactsB.map(contact =>
    parseDateTime(contact.date, contact.time)
  )
  const firstB = new Date(Math.min(...datesB.map(d => d.getTime())))
  const lastB = new Date(Math.max(...datesB.map(d => d.getTime())))
  const timeSpanB = lastB.getTime() - firstB.getTime()

  // Shorter time span is better
  return timeSpanA - timeSpanB
}

// The tiebreaker function map
export const tiebreakers: Record<
  TieBreakerRule,
  (
    a: Callsign,
    b: Callsign,
    scoredContacts: Map<Callsign, ValidContact[]>
  ) => number
> = {
  default: defaultTiebreaker,
  validStations: validStationsTiebreaker,
  minimumTime: minimumTimeTiebreaker,
}
