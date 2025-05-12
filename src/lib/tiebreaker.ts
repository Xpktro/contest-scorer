import type {
  Callsign,
  ValidContact,
  ContestRules,
  ScoringResult,
} from './types'
import { tiebreakers } from './rules/tiebreakers'

export const applyTiebreakers = (
  results: ScoringResult[],
  scoredContacts: Map<Callsign, ValidContact[]>,
  rules: ContestRules
): ScoringResult[] => {
  // If no tiebreaker rules, do not sort
  const tiebreaker = rules.rules.tiebreaker || []
  if (tiebreaker.length === 0) {
    return results
  }

  // Group results by score
  const groupedByScore = results.reduce(
    (acc, result) => {
      const [callsign, score] = result
      if (!acc[score]) {
        acc[score] = []
      }
      acc[score].push(callsign)
      return acc
    },
    {} as Record<number, Callsign[]>
  )

  const finalResults: ScoringResult[] = []

  // Process groups in descending score order
  Object.entries(groupedByScore)
    .sort(([scoreA], [scoreB]) => Number(scoreB) - Number(scoreA))
    .forEach(([score, callsigns]) => {
      const numericScore = Number(score)

      if (callsigns.length === 1) {
        finalResults.push([callsigns[0]!, numericScore])
      } else {
        const sortedCallsigns = [...callsigns].sort((a, b) => {
          // Apply each tiebreaker rule in order until tie is broken
          for (const rule of tiebreaker) {
            if (tiebreakers[rule]) {
              const result = tiebreakers[rule](a, b, scoredContacts)
              if (result !== 0) {
                return result
              }
            }
          }
          // If all tiebreakers resulted in a tie, maintain original order
          return 0
        })

        // Add sorted callsigns to final results
        sortedCallsigns.forEach(callsign => {
          finalResults.push([callsign, numericScore])
        })
      }
    })

  return finalResults
}
