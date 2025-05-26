import type {
  Participant,
  ContestResult,
  ContestRules,
  ScoringResult,
} from 'types'
import { scoreContacts } from 'lib/scorer'
import { validateContacts } from 'lib/validator'
import { applyBonusRules } from 'lib/bonus'
import { applyTiebreakers } from 'lib/tiebreaker'
import { getRulesContext } from './precalculate'

export const scoreContest = (
  submissions: Participant[],
  rules: ContestRules
): ContestResult => {
  const rulesContext = getRulesContext(rules)

  const {
    validContacts,
    scoringDetails,
    missingParticipants,
    blacklistedCallsignsFound,
  } = validateContacts(submissions, rulesContext)

  const scoredContacts = scoreContacts(
    validContacts,
    rulesContext,
    scoringDetails
  )

  const results = applyBonusRules(
    scoredContacts,
    rules,
    rulesContext,
    scoringDetails
  )

  // Filter out missing participants (those with empty contact arrays)
  // Missing participants award points but don't appear in rankings
  const filteredResults = results.filter(([callsign, _]) => {
    const contacts = scoredContacts.get(callsign) || []
    return contacts.length > 0
  })

  const sortedResults = filteredResults.sort(
    (a: ScoringResult, b: ScoringResult) => b[1] - a[1]
  )

  const tiebreakerResults = applyTiebreakers(
    sortedResults,
    scoredContacts,
    rules
  )

  return {
    results: tiebreakerResults,
    scoringDetails,
    missingParticipants: Array.from(missingParticipants),
    blacklistedCallsignsFound: Array.from(blacklistedCallsignsFound),
  } as ContestResult
}

export * from 'lib/scorer'
export * from 'lib/validator'
export * from 'lib/bonus'
export * from 'lib/tiebreaker'
