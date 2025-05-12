import type { Contact, ValidationRuleConfig } from 'types'

export const getDateTimeFromContact = (
  contact: Contact
): { date: string; time: string } => ({
  date: contact.qso_date || '',
  time: contact.time_on || '',
})

export const parseDateTime = (date: string, time: string): Date => {
  // Format: YYYYMMDD and HHMMSS
  const year = date.slice(0, 4)
  const month = date.slice(4, 6)
  const day = date.slice(6, 8)

  const hour = time.slice(0, 2)
  const minute = time.slice(2, 4)
  const second = time.slice(4, 6)

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)
}

export const getTimeDiffInMinutes = (date1: Date, date2: Date): number =>
  Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60)

export const formatDateTime = (date: Date): string =>
  date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, 'Z')

// Helper function to safely compare frequencies with tolerance to avoid floating point precision issues
export const areFrequenciesWithinTolerance = (
  freq1: string | number,
  freq2: string | number,
  toleranceMhz: number
): boolean => {
  // Convert to numbers and handle cases where frequencies might be invalid
  const freqNum1 = typeof freq1 === 'string' ? Number(freq1) : freq1
  const freqNum2 = typeof freq2 === 'string' ? Number(freq2) : freq2

  if (isNaN(freqNum1) || isNaN(freqNum2)) {
    return false
  }

  // Calculate difference and compare using fixed precision
  // Multiply by 1000 to convert MHz to kHz for more precise integer comparison
  const diff = Math.abs(freqNum1 * 1000 - freqNum2 * 1000)
  const toleranceKhz = toleranceMhz * 1000

  return diff <= toleranceKhz
}

export const extractRule = (rules: ValidationRuleConfig[], name: string) =>
  rules.find(rule => {
    const ruleName = typeof rule === 'string' ? rule : rule[0]
    return ruleName === name
  })
