import type { ContestRules, RulesContext } from 'types'
import { extractRule } from 'utils'

export const getRulesContext = (contestRules: ContestRules): RulesContext => {
  const timeRangeRule = extractRule(
    contestRules.rules.validation,
    'uniqueContactsByTimeRange'
  )

  const timeRanges: Record<string, { start: Date; end: Date }> =
    timeRangeRule && Array.isArray(timeRangeRule) && timeRangeRule[1]
      ? Object.entries(
          timeRangeRule[1] as Record<string, [string, string]>
        ).reduce(
          (acc, [rangeName, [start, end]]) => {
            acc[rangeName] = {
              start: new Date(start),
              end: new Date(end),
            }
            return acc
          },
          {} as Record<string, { start: Date; end: Date }>
        )
      : {}

  const bandsRule = extractRule(contestRules.rules.validation, 'bands')

  const bandRanges =
    bandsRule && Array.isArray(bandsRule) && bandsRule[1]
      ? Object.entries(bandsRule[1] as Record<string, [string, string]>).map(
          ([bandName, [startFreq, endFreq]]) => ({
            start: Number(startFreq),
            end: Number(endFreq),
            name: bandName,
          })
        )
      : []

  const contestStart = new Date(contestRules.start)
  const contestEnd = new Date(contestRules.end)

  return {
    contestRules,
    contestStart,
    contestEnd,
    timeRanges,
    bandRanges,
  }
}
