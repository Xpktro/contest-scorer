import type { ScoringContext, BonusRule } from 'lib/types'

export const defaultBonus = (
  score: number,
  _: ScoringContext,
  multiplier: number = 1
): number => score * multiplier

export const bonusers: Record<BonusRule, any> = {
  default: defaultBonus,
}
