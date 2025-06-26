#!/usr/bin/env bun
import { join, basename } from 'path'
import {
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'fs'
import { readFile } from 'node:fs/promises'
import { AdifParser } from 'adif-parser-ts'
import type { ContestRules, Participant } from 'lib/types'
import { Command } from 'commander'
import { scoreContest } from 'index'
import { formatDateTime } from 'utils'
import { AsciiTable3, AlignmentEnum } from 'ascii-table3'

// Define CLI colors for better output formatting
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
}

const getVersion = (): string => {
  try {
    const packageJsonPath = join(import.meta.dir, '..', '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version || 'unstable'
  } catch (error) {
    return 'unstable'
  }
}

const program = new Command()

program
  .name('contest-scorer')
  .description('Score ham radio contests from ADIF files')
  .version(getVersion())

program
  .command('score')
  .description('Score a contest using ADIF files')
  .requiredOption('-i, --input <dir>', 'Directory containing ADIF files')
  .option(
    '-r, --rules <file>',
    'JSON file containing contest rules',
    'rules.json'
  )
  .option('-o, --output <file>', 'Output CSV file')
  .option('-v, --verbose', 'Display detailed scoring information')
  .action(async options => {
    try {
      if (!existsSync(options.input)) {
        console.error(
          `${colors.red}Error: Input directory ${options.input} does not exist${colors.reset}`
        )
        process.exit(1)
      }

      const rulesPath = join(options.input, options.rules)
      if (!existsSync(rulesPath)) {
        console.error(
          `${colors.red}Error: Rules file ${rulesPath} does not exist${colors.reset}`
        )
        process.exit(1)
      }

      // Read and parse rules file
      let rules: ContestRules
      try {
        const rulesJson = await readFile(rulesPath, 'utf-8')
        rules = JSON.parse(rulesJson)

        // Validate essential rules properties
        if (!rules.name || !rules.start || !rules.end || !rules.rules) {
          throw new Error(
            'Required fields missing in rules file (name, start, end, rules)'
          )
        }

        if (
          !rules.rules.validation ||
          !rules.rules.scoring ||
          !rules.rules.bonus
        ) {
          throw new Error(
            'Required rules sections missing (validation, scoring, bonus)'
          )
        }
      } catch (error) {
        console.error(
          `${colors.red}Error parsing rules file: ${error}${colors.reset}`
        )
        process.exit(1)
      }

      console.log(
        `${colors.bold}${colors.green}Scoring contest: ${rules.name}${colors.reset}`
      )
      console.log(
        `${colors.blue}Contest period: ${formatDateTime(new Date(rules.start))} to ${formatDateTime(new Date(rules.end))}${colors.reset}`
      )

      // Read all ADIF files from the input directory
      const files = readdirSync(options.input).filter(
        file =>
          file.toLowerCase().endsWith('.adi') ||
          file.toLowerCase().endsWith('.adif')
      )

      if (files.length === 0) {
        console.error(
          `${colors.red}No ADIF files found in the input directory${colors.reset}`
        )
        process.exit(1)
      }

      console.log(
        `${colors.green}Found ${files.length} ADIF files${colors.reset}`
      )

      // Parse each ADIF file and create submissions
      const submissions: Participant[] = []
      const errorFiles: string[] = []

      for (const file of files) {
        const filePath = join(options.input, file)

        try {
          const adifData = await readFile(filePath, 'utf-8')

          // Extract callsign from filename (assuming format is CALLSIGN.adi)
          const callsign = basename(
            file,
            file.toLowerCase().endsWith('.adi') ? '.adi' : '.adif'
          )

          try {
            const parseResult = AdifParser.parseAdi(adifData)

            if (parseResult.records && parseResult.records.length > 0) {
              submissions.push([callsign.toUpperCase(), parseResult.records])
              console.log(
                `${colors.cyan}Parsed ${parseResult.records.length} contacts from ${file}${colors.reset}`
              )
            } else {
              console.warn(
                `${colors.yellow}Warning: No contacts found in ${file}${colors.reset}`
              )
            }
          } catch (error) {
            console.error(
              `${colors.red}Error parsing ${file}: ${error}${colors.reset}`
            )
            errorFiles.push(file)
          }
        } catch (error) {
          console.error(
            `${colors.red}Error reading file ${file}: ${error}${colors.reset}`
          )
          errorFiles.push(file)
        }
      }

      if (submissions.length === 0) {
        console.error(`${colors.red}No valid submissions found${colors.reset}`)
        process.exit(1)
      }

      if (errorFiles.length > 0) {
        console.warn(
          `${colors.yellow}Warning: ${errorFiles.length} files had errors and were skipped${colors.reset}`
        )
      }

      // Score the contest
      console.log(`${colors.magenta}Scoring contest...${colors.reset}`)
      const scoredContest = scoreContest(submissions, rules)

      // Create output directory if it doesn't exist
      const outputDir =
        options.output?.split('/').slice(0, -1).join('/') ?? options.input
      if (outputDir && !existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }

      // Write results to CSV
      let csv = 'Rank,Callsign,Score\n'
      scoredContest.results.forEach(([callsign, score], index) => {
        csv += `${index + 1},${callsign},${score}\n`
      })

      const csvFilePath = options.output ?? join(options.input, 'results.csv')

      writeFileSync(csvFilePath, csv)
      console.log(
        `${colors.green}Results written to ${csvFilePath}${colors.reset}`
      )

      const jsonFilePath = csvFilePath.replace(/\.csv$/, '.json')
      writeFileSync(jsonFilePath, JSON.stringify(scoredContest, null, 2))
      console.log(
        `${colors.green}Detailed results written to ${jsonFilePath}${colors.reset}`
      )

      // Display results in console
      console.log('\n' + colors.bold + colors.green + 'Results:' + colors.reset)

      const table = new AsciiTable3('Contest Results')
        .setHeading('Rank', 'Callsign', 'Score')
        .setAlign(3, AlignmentEnum.RIGHT)

      scoredContest.results.forEach(([callsign, score], index) => {
        table.addRow(index + 1, callsign, score)
      })

      table.setStyle('unicode-single').setCellMargin(1)

      console.log(table.toString())

      // If verbose mode is enabled, show more details
      if (options.verbose) {
        console.log(
          '\n' +
            colors.bold +
            colors.magenta +
            'Missing Participants:' +
            colors.reset
        )
        if (scoredContest.missingParticipants.length > 0) {
          const missingTable = new AsciiTable3()
            .setHeading('Callsign')
            .setStyle('unicode-single')

          scoredContest.missingParticipants.forEach(callsign => {
            missingTable.addRow(callsign)
          })

          console.log(missingTable.toString())
        } else {
          console.log('None')
        }

        if (scoredContest.blacklistedCallsignsFound.length > 0) {
          console.log(
            '\n' +
              colors.bold +
              colors.red +
              'Blacklisted Callsigns Found:' +
              colors.reset
          )
          const blacklistTable = new AsciiTable3()
            .setHeading('Callsign')
            .setStyle('unicode-single')

          scoredContest.blacklistedCallsignsFound.forEach(callsign => {
            blacklistTable.addRow(callsign)
          })

          console.log(blacklistTable.toString())
        }

        console.log(
          '\n' + colors.bold + colors.cyan + 'Detailed Scoring:' + colors.reset
        )

        for (const [callsign, details] of Object.entries(
          scoredContest.scoringDetails
        )) {
          console.log(
            `\n${colors.bold}${colors.cyan}${callsign}${colors.reset} - ${colors.bold}Total Score: ${details.contacts.reduce((sum, c) => sum + (c.invalidValidationRule ? 0 : c.givenScore), 0)}${colors.reset}`
          )

          const detailsTable = new AsciiTable3(`${callsign} Contacts`)
            .setHeading(
              'Contacted',
              'Time',
              'Band',
              'Mode',
              'Valid',
              'Invalid Validation Rule',
              'Scoring Rule',
              'Score'
            )
            .setAlign(5, AlignmentEnum.RIGHT)
            .setStyle('unicode-single')

          details.contacts.forEach(contact => {
            const isValid = !contact.invalidValidationRule
            const validText = isValid ? 'Yes' : 'No'
            const score = isValid ? contact.givenScore : 0

            detailsTable.addRow(
              contact.call,
              `${contact.qso_date} ${contact.time_on}`,
              contact.band || contact.freq,
              contact.mode,
              validText,
              contact.invalidValidationRule || '(none)',
              contact.scoreRule || '(none)',
              score
            )
          })

          console.log(detailsTable.toString())

          if (details.givenBonus > 0) {
            console.log(
              `${colors.yellow}Bonus Rule Applied: ${details.bonusRuleApplied || 'default'} (Bonus points: ${details.givenBonus})${colors.reset}`
            )
          }
        }
      }
    } catch (error) {
      console.error(`${colors.red}Error: ${error}${colors.reset}`)
      process.exit(1)
    }
  })

program.parse()
