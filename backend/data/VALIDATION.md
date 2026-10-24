# Course data validation

Source: `cur_m_cur_subject_2563_202605071501.csv`

- Source rows: 45,039
- Prepared rows: 45,029
- Duplicate rows removed: 10
- Rejected rows: 0
- Unique full course codes: 45,028
- Base codes (exploratory only): 21,326
- Codes with conflicting records: 1

## Counting limits

The backlog estimates 56,260 input rows and quotes 12,456 courses from an SRS. This supplied export does not establish either number. The SRS was not supplied. Course codes include suffixes; their meaning and a rule for selecting the active curriculum must be confirmed before reducing the catalog to base codes. No rows were discarded simply to reach the expected count.

## Preparation policy

Apply Unicode NFC normalization, trim text, and collapse whitespace. Preserve Thai marks, English case, punctuation, leading zeros, and code suffixes. Remove only records identical across all five normalized fields. Reject missing codes and records without any searchable text. Keep differing records under the same code for review; details and source record numbers (header is record 1) are in `validation.json`. Do not remove boilerplate without an approved rule.

## Missing data

This export contains only codes, names, and descriptions. Credits, faculty, department, sections, days, and start/end times need an authoritative semester dataset before the timetable MVP can use real data.

## Reproducibility

The original export is preserved. `validation.json` records a source SHA-256, a version derived from ordered prepared records and the normalization policy, and the report generation time in UTC (`updated_at`, not a source modification date). Re-running preparation produces the same cleaned data and version.
