/**
 * Utilities for testing the contest-scorer with the new detailed result format
 */
import type { ContestResult, Callsign } from '../../src/lib/types'

/**
 * Get just the results array from a detailed contest result
 */
export function getResults(detailedResults: ContestResult) {
  return detailedResults.results
}

/**
 * Find a result by callsign in the detailed contest results
 */
export function findResultByCallsign(
  detailedResults: ContestResult,
  callsign: Callsign
) {
  return detailedResults.results.find(([cs]) => cs === callsign)
}

/**
 * Get the score for a callsign from the detailed contest results
 */
export function getScoreForCallsign(
  detailedResults: ContestResult,
  callsign: Callsign
) {
  const result = findResultByCallsign(detailedResults, callsign)
  return result ? result[1] : null
}

/**
 * Get the scoring details for a specific callsign
 */
export function getScoringDetailsForCallsign(
  detailedResults: ContestResult,
  callsign: Callsign
) {
  return detailedResults.scoringDetails[callsign]
}

/**
 * Get the list of missing participants
 */
export function getMissingParticipants(detailedResults: ContestResult) {
  return detailedResults.missingParticipants
}

/**
 * Get the list of blacklisted participants that were found in contacts
 */
export function getBlacklistedParticipants(detailedResults: ContestResult) {
  return detailedResults.blacklistedCallsignsFound
}

/**
 * Get the number of valid contacts for a callsign
 */
export function getValidContactCount(
  detailedResults: ContestResult,
  callsign: Callsign
) {
  const details = getScoringDetailsForCallsign(detailedResults, callsign)
  if (!details) return 0
  return details.contacts.filter(c => !c.invalidValidationRule).length
}

/**
 * Get all invalid contacts for a callsign
 */
export function getInvalidContacts(
  detailedResults: ContestResult,
  callsign: Callsign
) {
  const details = getScoringDetailsForCallsign(detailedResults, callsign)
  if (!details) return []
  return details.contacts.filter(c => c.invalidValidationRule)
}

/**
 * Get all contacts that were invalidated by a specific rule
 */
export function getContactsInvalidatedByRule(
  detailedResults: ContestResult,
  callsign: Callsign,
  rule: string
) {
  const details = getScoringDetailsForCallsign(detailedResults, callsign)
  if (!details) return []
  return details.contacts.filter(c => c.invalidValidationRule === rule)
}

/**
 * Check if a callsign has the minimum number of appearances
 */
export function hasMinimumAppearances(
  detailedResults: ContestResult,
  callsign: Callsign
) {
  const details = getScoringDetailsForCallsign(detailedResults, callsign)
  return details?.hasMinimumAppearances || false
}

/**
 * Get the bonus multiplier applied to a callsign
 */
export function getBonusMultiplier(
  detailedResults: ContestResult,
  callsign: Callsign
) {
  const details = getScoringDetailsForCallsign(detailedResults, callsign)
  return details?.givenBonus || 1
}
