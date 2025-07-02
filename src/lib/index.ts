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

const formatCounts = (callsigns: Set<string>, counts: Map<string, number>) =>
  Array.from(callsigns)
    .map<[string, number]>(callsign => [callsign, counts.get(callsign) || 0])
    .sort((a, b) => a[0].localeCompare(b[0]))

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
    appearanceCounts,
    blacklistedAppearanceCounts,
  } = validateContacts(submissions, rulesContext)

  const scoredContacts = scoreContacts(
    validContacts,
    rulesContext,
    scoringDetails,
    appearanceCounts
  )

  const results = applyBonusRules(
    scoredContacts,
    rules,
    rulesContext,
    scoringDetails
  )

  const nonCompetingCallsigns = new Set(rules.nonCompeting || [])
  const { competingResults, nonCompetingResults } = results.reduce(
    ({ competingResults, nonCompetingResults }, result) =>
      nonCompetingCallsigns.has(result[0])
        ? {
            competingResults,
            nonCompetingResults: nonCompetingResults.concat([result]),
          }
        : {
            competingResults: competingResults.concat([result]),
            nonCompetingResults,
          },
    {
      competingResults: [] as ScoringResult[],
      nonCompetingResults: [] as ScoringResult[],
    }
  )

  const sortedResults = competingResults.sort(
    (a: ScoringResult, b: ScoringResult) => b[1] - a[1]
  )

  const sortedNonCompetingResults = nonCompetingResults.sort(
    (a: ScoringResult, b: ScoringResult) => b[1] - a[1]
  )

  const tiebreakerResults = applyTiebreakers(
    sortedResults,
    scoredContacts,
    rules
  )

  return {
    results: tiebreakerResults,
    nonCompetingResults: sortedNonCompetingResults,
    scoringDetails,
    missingParticipants: formatCounts(missingParticipants, appearanceCounts),
    blacklistedCallsignsFound: formatCounts(
      blacklistedCallsignsFound,
      blacklistedAppearanceCounts
    ),
  } as ContestResult
}

export * from 'lib/scorer'
export * from 'lib/validator'
export * from 'lib/bonus'
export * from 'lib/tiebreaker'
