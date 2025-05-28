import type {
  Callsign,
  ValidContact,
  ContestRules,
  ScoringContext,
  ScoringResult,
  RulesContext,
  ParticipantScoringDetail,
} from './types'
import { bonusers } from './rules/bonusers'

export const applyBonusRules = (
  scoredContacts: Map<Callsign, ValidContact[]>,
  rules: ContestRules,
  rulesContext: RulesContext,
  scoringDetails: Record<string, Partial<ParticipantScoringDetail>>
): ScoringResult[] => {
  const context: ScoringContext = {
    validContacts: scoredContacts,
    timeRanges: rulesContext.timeRanges,
  }

  return Array.from(scoredContacts.entries()).map(([callsign, contacts]) => {
    const baseScore = contacts.reduce((sum, contact) => sum + contact.score, 0)

    if (callsign in scoringDetails) {
      scoringDetails[callsign]!.bonusRuleApplied = null
      scoringDetails[callsign]!.givenBonus = 0
    }

    const finalScore = rules.rules.bonus.reduce((currentScore, rule) => {
      const [ruleName, params] = Array.isArray(rule) ? rule : [rule, undefined]

      const score = bonusers[ruleName](currentScore, context, params)

      if (callsign in scoringDetails && score !== currentScore) {
        scoringDetails[callsign]!.bonusRuleApplied = ruleName
        scoringDetails[callsign]!.givenBonus = score - currentScore
      }

      return score
    }, baseScore)

    return [callsign, finalScore]
  })
}
