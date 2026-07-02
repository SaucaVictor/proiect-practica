---
name: jira-get-worklogs
description: Verify total logged hours and task breakdown on Jira. Use when the user asks "how many hours do I have in Jira", "show my logged hours", "cate ore am in jira", "vezi orele din jira" etc.
---

# Jira Get Worklogs

## Purpose

Check the total worklog hours and detailed task-by-task breakdown logged by the current user on Jira, using credentials from the project `.env` file.

## Activation

Trigger phrases (examples):
- "how many hours do I have in Jira?"
- "show my logged hours"
- "cate ore am in jira"
- "vezi orele din jira"
- "arata-mi orele lucrate"

## Required inputs

- None (loads configurations dynamically from `.env`)

## Execution

### Step 1 — Load credentials from `.env`

Read `{project-root}/.env` and extract:
- `JIRA_API_TOKEN`
- `JIRA_EMAIL`
- `JIRA_BASE_URL`
- `JIRA_PROJECT_KEY`

If any are missing, inform the user and stop.

### Step 2 — Fetch issues and calculate worklogs

Run a PowerShell command to query the Jira REST API:

1. Call the issue search endpoint (using the modern `/search/jql` endpoint to avoid `410 Gone` errors):
   ```
   GET {JIRA_BASE_URL}/rest/api/3/search/jql?jql=project = {JIRA_PROJECT_KEY}&fields=summary
   ```
2. Loop over all retrieved issues. For each issue, query the worklogs:
   ```
   GET {JIRA_BASE_URL}/rest/api/3/issue/{issue_key}/worklog
   ```
3. Filter worklog entries where `author.emailAddress` matches `JIRA_EMAIL`.
4. Group and sum `timeSpentSeconds` by issue key/summary.

Here is the recommended template PowerShell script to run:
```powershell
$envVars = @{}
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.+)$") { $envVars[$matches[1].Trim()] = $matches[2].Trim() }
}
$cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($envVars['JIRA_EMAIL']):$($envVars['JIRA_API_TOKEN'])"))
$headers = @{ Authorization = "Basic $cred"; "Content-Type" = "application/json" }
$base = $envVars['JIRA_BASE_URL'].TrimEnd('/')
$myEmail = $envVars['JIRA_EMAIL'].Trim()

$jql = "project = $($envVars['JIRA_PROJECT_KEY'])"
$searchUrl = "$base/rest/api/3/search/jql?jql=" + [uri]::EscapeDataString($jql) + "&fields=summary"
$searchResult = Invoke-RestMethod -Uri $searchUrl -Headers $headers -Method Get

$userLogs = @()
$totalSeconds = 0

foreach ($issue in $searchResult.issues) {
    $key = $issue.key
    $summary = $issue.fields.summary
    
    $wlUrl = "$base/rest/api/3/issue/$key/worklog"
    $wlResult = Invoke-RestMethod -Uri $wlUrl -Headers $headers -Method Get
    
    foreach ($wl in $wlResult.worklogs) {
        if ($wl.author.emailAddress -eq $myEmail) {
            $commentText = "Fără comentariu"
            try { $commentText = $wl.comment.content[0].content[0].text } catch {}

            $userLogs += [PSCustomObject]@{
                Key = $key
                Summary = $summary
                TimeSpent = $wl.timeSpent
                Seconds = $wl.timeSpentSeconds
                Comment = $commentText
                Date = $wl.started
            }
            $totalSeconds += $wl.timeSpentSeconds
        }
    }
}

$output = @{
    TotalHours = $totalSeconds / 3600
    Logs = $userLogs
}
$output | ConvertTo-Json -Depth 5
```

### Step 3 — Format and present the findings

Present the total hours logged (in hours and minutes) and a structured markdown list of all logged tasks, including:
- Issue Key and Summary
- Worklog description / comment
- Date of work
- Time spent on that specific log entry
