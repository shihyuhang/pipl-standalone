param(
    [string]$SchemaRoot
)

$ErrorActionPreference = 'Stop'

$schemaRoot = if ($SchemaRoot) { $SchemaRoot } else { $PSScriptRoot }
$projectRoot = Split-Path -Parent $schemaRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Read-JsonFile([string]$path) {
    try {
        return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        $failures.Add("Invalid JSON: $path; $($_.Exception.Message)")
        return $null
    }
}

function Find-Duplicates([object[]]$values) {
    return @($values | Where-Object { $_ } | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name)
}

function Add-FailureIfAny([string]$label, [object[]]$values) {
    $items = @($values | Where-Object { $_ } | Sort-Object -Unique)
    if ($items.Count -gt 0) {
        $failures.Add("$label`: $($items -join ', ')")
    }
}

$fact = Read-JsonFile (Join-Path $schemaRoot 'fact-schema.v1.json')
$questions = Read-JsonFile (Join-Path $schemaRoot 'question-tree.v1.json')
$scenarios = Read-JsonFile (Join-Path $schemaRoot 'scenario-catalog.v1.json')
$ruleset = Read-JsonFile (Join-Path $schemaRoot 'ruleset.v1.json')

if ($null -in @($fact, $questions, $scenarios, $ruleset)) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

$factCodes = @($fact.'$defs'.factCode.enum)
$questionCodes = @($questions.questions.code)
$scenarioCodes = @($scenarios.scenarios.code)
$ruleCodes = @($ruleset.rules.code)

Add-FailureIfAny 'Duplicate fact codes' (Find-Duplicates $factCodes)
Add-FailureIfAny 'Duplicate question codes' (Find-Duplicates $questionCodes)
Add-FailureIfAny 'Duplicate scenario codes' (Find-Duplicates $scenarioCodes)
Add-FailureIfAny 'Duplicate rule codes' (Find-Duplicates $ruleCodes)

$phaseQuestionCodes = @($questions.phases.questionCodes | ForEach-Object { $_ })
$mappedFactCodes = @($questions.questions.factMappings.factCode | ForEach-Object { $_ })
$scenarioQuestionCodes = @($scenarios.scenarios.questionCodes | ForEach-Object { $_ }) +
    @($scenarios.crossCuttingBranches.questionCodes | ForEach-Object { $_ })
$requiredRuleFacts = @($ruleset.rules.requiredFacts | ForEach-Object { $_ })

Add-FailureIfAny 'Unknown questions referenced by phases' @($phaseQuestionCodes | Where-Object { $_ -notin $questionCodes })
Add-FailureIfAny 'Unknown facts referenced by questions' @($mappedFactCodes | Where-Object { $_ -notin $factCodes })
Add-FailureIfAny 'Unknown questions referenced by scenarios' @($scenarioQuestionCodes | Where-Object { $_ -notin $questionCodes })
Add-FailureIfAny 'Unknown facts required by rules' @($requiredRuleFacts | Where-Object { $_ -notin $factCodes })

$docFiles = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'docs') -File -Filter '*.md'
$ruleDocFile = $docFiles | Where-Object { (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8) -match 'R-QUAL-001' } | Select-Object -First 1
$scenarioDocFile = $docFiles | Where-Object { (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8) -match 'SCN-B2B-CONTACT' } | Select-Object -First 1
if (-not $ruleDocFile) { $failures.Add('Rule mapping Markdown file not found') }
if (-not $scenarioDocFile) { $failures.Add('Scenario catalog Markdown file not found') }
$ruleDoc = if ($ruleDocFile) { Get-Content -LiteralPath $ruleDocFile.FullName -Raw -Encoding UTF8 } else { '' }
$scenarioDoc = if ($scenarioDocFile) { Get-Content -LiteralPath $scenarioDocFile.FullName -Raw -Encoding UTF8 } else { '' }
$docRuleCodes = @([regex]::Matches($ruleDoc, 'R-[A-Z]+-[0-9]{3}') | ForEach-Object Value | Sort-Object -Unique)
$docScenarioCodes = @([regex]::Matches($scenarioDoc, 'SCN-[A-Z0-9-]+') | ForEach-Object Value | Sort-Object -Unique)

Add-FailureIfAny 'Rules present in JSON but absent from Markdown' @($ruleCodes | Where-Object { $_ -notin $docRuleCodes })
Add-FailureIfAny 'Rules present in Markdown but absent from JSON' @($docRuleCodes | Where-Object { $_ -notin $ruleCodes })
Add-FailureIfAny 'Scenarios present in JSON but absent from Markdown' @($scenarioCodes | Where-Object { $_ -notin $docScenarioCodes })
Add-FailureIfAny 'Scenarios present in Markdown but absent from JSON' @($docScenarioCodes | Where-Object { $_ -notin $scenarioCodes })

if ($scenarios.PSObject.Properties.Name -contains 'asOfDate') {
    $failures.Add('Scenario catalog must not use asOfDate as a legal applicability switch')
}
if (($ruleset | ConvertTo-Json -Depth 100) -match 'effectiveFrom|effective_from|published_not_effective') {
    $failures.Add('Ruleset must not contain legal effective-date switch fields or states')
}

$expectedCounts = @{
    facts = 171
    questions = 66
    scenarios = 8
    rules = 52
}
$actualCounts = @{
    facts = $factCodes.Count
    questions = $questionCodes.Count
    scenarios = $scenarioCodes.Count
    rules = $ruleCodes.Count
}
foreach ($key in $expectedCounts.Keys) {
    if ($actualCounts[$key] -ne $expectedCounts[$key]) {
        $failures.Add("Baseline count mismatch: $key expected $($expectedCounts[$key]), actual $($actualCounts[$key])")
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

[pscustomobject]@{
    Status = 'PASS'
    FactCodes = $factCodes.Count
    Questions = $questionCodes.Count
    Phases = @($questions.phases).Count
    Scenarios = $scenarioCodes.Count
    Rules = $ruleCodes.Count
    Message = 'Parsing, references, code alignment, and no-date-switch checks passed'
} | Format-List
