# Contest Scorer

A ham radio contest scoring tool built with Bun and TypeScript. This tool reads ADIF files from contest participants and scores them according to configurable rules.

## Features

- Score ham radio contests using ADIF files
- Configurable validation, scoring, bonus, and tiebreaker rules
- Command-line interface with colored output

## Requirements

- [Bun](https://bun.sh/) 1.2.8 or later

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/contest-scorer.git
cd contest-scorer

# Install dependencies
bun install

# Build the project
bun run build
```

## Usage

### Command Line Interface

```bash
# Basic usage
bun start score --input ./logs

# With custom output file
bun start score --input ./logs --rules rules.json --output ./results/contest-results.csv

# Display help
bun start help
```

### Using as a Library

```typescript
import { scoreContest } from 'contest-scorer'
import { Participant, ContestRules } from 'contest-scorer/types'

// Define your contest rules
const rules: ContestRules = {
  name: 'My Contest',
  start: '2025-04-01T00:00:00Z',
  end: '2025-04-02T23:59:59Z',
  rules: {
    validation: [
      'timeRange',
      ['bands', { '40m': ['7000', '7300'] }],
      ['mode', ['SSB', 'CW']],
    ],
    scoring: [['default', 1]],
    bonus: [['default', 1]],
    tiebreaker: ['validStations'],
  },
}

// Define your submissions (callsign and ADIF data)
const submissions: Participant[] = [
  ['OA4T', adifData1],
  ['OA4P', adifData2],
]

// Score the contest
const results = scoreContest(submissions, rules)
console.log(results)
```

## Rules Configuration

Contest rules are defined in a JSON file with the following structure:

```json
{
  "name": "contest_name",
  "start": "2025-01-01T00:00:00Z",
  "end": "2025-01-01T00:59:59Z",
  "blacklist": ["callsign1", "callsign2"],
  "allowMissingParticipants": true,
  "rules": {
    "validation": [
      "rule1",
      ["rule2", { "param1": "value1", "param2": "value2" }]
    ],
    "scoring": ["default"],
    "bonus": [["rule1", { "param1": "value1" }]],
    "tiebreaker": ["rule1", "rule2"]
  }
}
```

### Validation Rules

- `default`: Validates if there's a matching contact record in the contacted callsign's log. Takes optional parameters:
  - `maximumTimeDiff`: Maximum time difference in minutes (default: 2)
  - `maximumFrequencyDiff`: Maximum frequency difference in kHz (default: 2)
- `timeRange`: Validates if the contact is within the contest time range.
- `bands`: Validates if the contact is on a valid band. Format: `{"band1": ["start", "end"], "band2": ["start", "end"]}`
- `mode`: Validates if the contact is using a valid mode. Format: `["mode1", "mode2"]`
- `contactedInContest`: Validates if the contacted callsign is a participant in the contest.
- `uniqueContactsByTimeRange`: Validates one contacted callsign per time range. Format: `{"firstHalf": ["start", "end"], "secondHalf": ["start", "end"]}`
- `exchange`: Validates if the contact has a valid exchange using a regex.
- `minimumContacts`: Validates if the participant has appeared in the contest at least a given number of times. This rule also enables "missing participants" - stations that don't submit logs but can still award points if they appear in enough logs. Format: `5`

#### Top-level Validation Rules

- `blacklist`: Excludes specific callsigns from receiving or awarding points and from appearing in the final rankings. Format: `["callsign1", "callsign2"]`
- `allowMissingParticipants`: Controls whether contacts with stations that did not submit a log should be validated and their contacts scored. When true, contacts with missing participants are accepted and scored. When false or not defined, contacts with missing participants are rejected. Format: `true/false`

### Scoring Rules

- `default`: Assigns a default score to each contact. Default is 1.
- `timeRange`: Assigns different scores based on time ranges. Format: `{"firstHalf": 2, "secondHalf": 3}`
- `bonusStations`: Assigns bonus scores for contacting certain stations. Format: `{"OA4O": 5, "OA4EFJ": 3}`

### Bonus Rules

- `default`: Multiplies the total score by a value. Default is 1.

### Tiebreaker Rules

- `default`: Sorts contestants by score.
- `validStations`: Breaks ties by the number of valid stations contacted (more is better).
- `minimumTime`: Breaks ties by the time span between first and last contact (less is better).

## ADIF Files

The tool expects ADIF files named with the participant's callsign (e.g., `OA4T.adi`). If the callsign cannot be determined from the filename, the contest cannot be properly scored.

## Development

```bash
# Run tests
bun test

# Run unit tests only
bun test:unit

# Run e2e tests only
bun test:e2e

# Format code
bun run format
```

## License

MIT
