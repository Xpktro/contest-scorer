import type { Participant, ScoringResult, ContestRules } from 'types'
import { scoreContacts } from 'lib/scorer'
import { validateContacts } from 'lib/validator'
import { applyBonusRules } from 'lib/bonus'
import { applyTiebreakers } from 'lib/tiebreaker'
import { getRulesContext } from './precalculate'

export const scoreContest = (
  submissions: Participant[],
  rules: ContestRules
): ScoringResult[] => {
  const rulesContext = getRulesContext(rules)

  const validContacts = validateContacts(submissions, rulesContext)
  const scoredContacts = scoreContacts(validContacts, rulesContext)
  const results = applyBonusRules(scoredContacts, rules, rulesContext)

  // Filter out missing participants (those with empty contact arrays)
  // Missing participants award points but don't appear in rankings
  const filteredResults = results.filter(([callsign, _]) => {
    const contacts = scoredContacts.get(callsign) || []
    return contacts.length > 0
  })

  const sortedResults = filteredResults.sort(
    (a: ScoringResult, b: ScoringResult) => b[1] - a[1]
  )
  return applyTiebreakers(sortedResults, scoredContacts, rules)
}

export * from 'lib/scorer'
export * from 'lib/validator'
export * from 'lib/bonus'
export * from 'lib/tiebreaker'
