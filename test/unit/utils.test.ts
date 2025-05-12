import { describe, test, expect } from 'bun:test'
import {
  getDateTimeFromContact,
  parseDateTime,
  getTimeDiffInMinutes,
  formatDateTime,
  areFrequenciesWithinTolerance,
} from 'utils'

describe('Utils', () => {
  test('getDateTimeFromContact extracts date and time correctly', () => {
    const contact = {
      qso_date: '20241225',
      time_on: '153000',
    }

    const result = getDateTimeFromContact(contact)
    expect(result).toEqual({
      date: '20241225',
      time: '153000',
    })
  })

  test('getDateTimeFromContact handles missing values', () => {
    const result = getDateTimeFromContact({})
    expect(result).toEqual({
      date: '',
      time: '',
    })
  })

  test('parseDateTime converts date and time strings to Date object', () => {
    const date = parseDateTime('20241225', '153000')
    expect(date.toISOString()).toBe('2024-12-25T15:30:00.000Z')
  })

  test('getTimeDiffInMinutes calculates time difference correctly', () => {
    const date1 = new Date('2024-12-25T15:30:00Z')
    const date2 = new Date('2024-12-25T15:32:30Z')

    const diff = getTimeDiffInMinutes(date1, date2)
    expect(diff).toBe(2.5)
  })

  test('formatDateTime formats date object to display string', () => {
    const date = new Date('2024-12-25T15:30:00Z')
    const formatted = formatDateTime(date)
    expect(formatted).toBe('2024-12-25 15:30:00Z')
  })

  test('areFrequenciesWithinTolerance handles floating point precision correctly', () => {
    // Test with the specific case mentioned in the bug report (7.1 vs 7.097 with 0.002 tolerance)
    expect(areFrequenciesWithinTolerance(7.1, 7.097, 0.002)).toBe(false) // Difference is 0.003, above tolerance
    expect(areFrequenciesWithinTolerance(7.1, 7.098, 0.002)).toBe(true) // Difference is 0.002, at tolerance
    expect(areFrequenciesWithinTolerance(7.1, 7.099, 0.002)).toBe(true) // Difference is 0.001, below tolerance

    // Test with string inputs
    expect(areFrequenciesWithinTolerance('7.1', '7.097', 0.002)).toBe(false)
    expect(areFrequenciesWithinTolerance('7.1', '7.098', 0.002)).toBe(true)

    // Test with invalid inputs
    expect(areFrequenciesWithinTolerance('invalid', 7.1, 0.002)).toBe(false)
    expect(areFrequenciesWithinTolerance(7.1, NaN, 0.002)).toBe(false)

    // Test other cases that could have floating point issues
    expect(areFrequenciesWithinTolerance(14.0, 14.0005, 0.001)).toBe(true) // Within tolerance
    expect(areFrequenciesWithinTolerance(14.0, 14.0015, 0.001)).toBe(false) // Outside tolerance
  })
})
