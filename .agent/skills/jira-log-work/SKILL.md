---
name: jira-log-work
description: Log work hours to a Jira issue. Use when the user says "log X hours on IOT-Y", "bagă X ore pe IOT-Y", "log work", or "actualizeaza jira cu orele".
---

# Jira Log Work

## Purpose

Log work hours (and optionally a comment) to a Jira issue using credentials from the project `.env` file.

## Activation

Trigger phrases (examples):
- "log 3h on IOT-5"
- "bagă 2h pe IOT-3"
- "actualizeaza jira, am lucrat 4h la IOT-7"
- "log work on IOT-5, 6 hours, BOM + schematic"

## Required inputs

Extract from the user's message:
- `issue_key` — e.g. `IOT-5` (required)
- `hours` — number of hours (required; accept "6h", "6 ore", "6 hours", "1.5h" etc.)
- `description` — optional summary of work done; if not provided, use a sensible default
- `start_time` — optional; default to today at 09:00 local time

If `issue_key` or `hours` are missing, ask for them before proceeding.

## Execution

### Step 1 — Load credentials from `.env`

Read `{project-root}/.env` and extract:
- `JIRA_API_TOKEN`
- `JIRA_EMAIL`
- `JIRA_BASE_URL`
- `JIRA_PROJECT_KEY`

If any are missing, tell the user which ones and stop.

### Step 2 — Convert hours to seconds

`timeSpentSeconds = hours * 3600`

### Step 3 — Call Jira worklog API

```
POST {JIRA_BASE_URL}/rest/api/3/issue/{issue_key}/worklog
Authorization: Basic base64(email:token)
Content-Type: application/json

{
  "timeSpentSeconds": <seconds>,
  "started": "<today>T09:00:00.000+0300",
  "comment": {
    "type": "doc", "version": 1,
    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "<description>"}]}]
  }
}
```

Run via PowerShell, loading credentials from `.env` without exposing them in the command.

### Step 4 — Confirm

Report: issue key, hours logged, time of log. If API returns error, show the status code and message.

## Constraints

- Never expose the API token in chat or terminal output
- Always load credentials from `.env`, never hardcode
- If the issue doesn't exist or the user lacks permission, report the error clearly
- Default start time: today at 09:00 local time unless user specifies otherwise
