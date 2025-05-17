This is a bun 1.2.8 project.

This project's purpose is to score a ham radio contest. Contests consist of people contacting other people in a given range of time. Each participant will submit an ADIF file with their contacts. This tool will read the ADIF files and score the contest based on a given set of rules.

This tool will consist of two things: a library that contains the scoring engine and a CLI that will read the ADIF files, score them using the library, and output the results.

The library will have an entry-point-function that will take a list of tuples that contains each participant callsign and AdifParser's SimpleAdif objects (e.g. ['OA4EFJ', SimpleAdifInstance]) and a set of rules. The function will return a list of tuples with the callsign and the score. The rules will be defined in a separate file, and the library will read them and apply them to the contacts.

Scoring works as follows:

1. Each contact from a given callsign should be validated against the rules.

- Rules for validation (if one validation fails, the contact is invalid and will be discarded):
  - 'default': The contact will be validated if there's a matching contact record in the contacted callsign list. A matching contact must have the same date and time (with a set tolerance in minutes), band, mode and exchange. Frequency matching is also performed with a tolerance. Params: {'maximumTimeDiff': 2, 'maximumFrequencyDiff': 2}
  - 'timeRange': The contact must be within the contest time range.
  - 'bands': The contact must be on a valid band. Params: {'band1': ['start', 'end'], 'band2': ['start', 'end']}
  - 'mode': The contact must be on a valid mode. Params: ['mode1', 'mode2']
  - 'contactedInContest': The contacted callsign must be a participant in the contest, it should be checked against the pool of submissions.
  - 'uniqueContactsByTimeRange': Only one contacted callsign is allowed per time range. Params: {'firstHalf': ['start', 'end'], 'secondHalf': ['start', 'end']}
  - 'exchange': The contact must have a valid exchange, provided by a regex. Params: 'regex'

If present in the configuration file, the following rules will be applied, which will validate/filter the each participant/submission:

- Special rules (after the initial validation):
  - 'minimumContacts': Contacts can only be valid if the participant has appeared in the contest at least a given number of times. Params: 5
  - 'blacklist': (Defined one level over the rule set). Exclude specific callsigns from receiving or awarding points and from appearing in the final ranking. Params: ['callsign1', 'callsign2']
  - 'allowMissingParticipants': (Defined one level over the rule set). Controls whether contacts with stations that did not submit a log should be validated and scored. When true, contacts with missing participants are accepted and scored. When false (or not specified), contacts with missing participants are rejected. Params: true/false

2. Each valid contact should be scored based on the rules.

- Rules for scoring (each rule overrides the previous one):

  - 'default': The contact will be scored with a default value. Params: 1
  - 'timeRange': The contact will be scored with a value based on the time range defined in the validations rule. Params: {'firstHalf': 2, 'secondHalf': 3}
  - 'bonusStations': Contacts with a given callsign will be scored with a bonus. Params: {'OA4O': 5}

3. Every scored contact from a given callsign will be summed to get the total score for that callsign.

4. Each score should be multiplied by a bonus based on the rules.

- Rules for bonus:
  - 'default': The score will be multiplied by a default value. Params: 1

5. Apply sorting by score and tiebreaker rules.

- Rules for tiebraker (if two or more contestants have the same score, the tie will be broken by the following rules):
  - 'default': Contestants will be sorted by score.
  - 'validStations': Contestants will be sorted by the number of valid stations contacted. (more is better)
  - 'minimumTime': Contestants will be sorted by the number of seconds between the first and last contact. (less is better)

All of the rules for validation must be indicated in the rules file. The rules file will be a JSON file that contains the rules for validation and scoring of the contacts. The rules will be defined in a JSON file that will be read by the library. The rules will be defined as follows:

```json
{
  "name": "contest_name",
  "start": "2025-01-01T00:00:00Z",
  "end": "2025-01-01T00:59:59Z",
  "allowMissingParticipants": true,
  "rules": {
    "validation": [
      "rule1",
      ["rule2", { "param1": "value1", "param2": "value2" }]
    ],
    "scoring": ["default"],
    "bonus": [
      ["rule1", { "param1": "value1", "param2": "value2" }],
      ["rule2", { "param1": "value1", "param2": "value2" }]
    ],
    "tiebraker": ["rule1", "rule2"]
  }
}
```

The CLI will receive a folder path as an input and will output a CSV file with the results (callsign and score) sorted by score.

All of the project should be written using a functional programming approach. Alongside to the src folder, a test folder should be present, covering as much of the sources as possible, including unit testing and e2e testing.

Reference: Example ADIF file

example.adif

```
TQSL ADIF export
<CREATED_TIMESTAMP:15>20250108 202041
<PROGRAMID:4>TQSL
<PROGRAMVERSION:5>2.7.5
<EOH>

<CALL:6>HJ5LVR <BAND:2>2M <MODE:2>FM <QSO_DATE:8>20241201 <TIME_ON:6>181100 <FREQ:7>145.990 <BAND_RX:4>70CM <FREQ_RX:7>437.800 <PROP_MODE:3>SAT <SAT_NAME:5>IO-86 <EOR>
<CALL:6>YV4GAC <BAND:2>2M <MODE:2>FM <QSO_DATE:8>20241201 <TIME_ON:6>181500 <FREQ:7>145.990 <BAND_RX:4>70CM <FREQ_RX:7>437.800 <PROP_MODE:3>SAT <SAT_NAME:5>IO-86 <EOR>
```
