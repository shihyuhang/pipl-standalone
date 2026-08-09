param(
    [string]$DifyRoot
)

$ErrorActionPreference = 'Stop'
$root = if ($DifyRoot) { $DifyRoot } else { $PSScriptRoot }
$projectRoot = Split-Path -Parent $root
$failures = [System.Collections.Generic.List[string]]::new()

function Read-JsonUtf8([string]$path) {
    try {
        return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        $failures.Add("Invalid JSON: $path; $($_.Exception.Message)")
        return $null
    }
}

function Add-FailureIfAny([string]$label, [object[]]$values) {
    $items = @($values | Where-Object { $_ } | Sort-Object -Unique)
    if ($items.Count -gt 0) {
        $failures.Add("$label`: $($items -join ', ')")
    }
}

$registryPath = Join-Path $root 'workflow-registry.v1.json'
$requestSchemaPath = Join-Path $projectRoot 'schemas\ai\ai-workflow-request.v1.schema.json'
$knowledgeSchemaPath = Join-Path $root 'knowledge-metadata-schema.v1.json'
$bindingExamplePath = Join-Path $root 'deployment-bindings.example.json'
$registry = Read-JsonUtf8 $registryPath
$requestSchema = Read-JsonUtf8 $requestSchemaPath
$knowledgeSchema = Read-JsonUtf8 $knowledgeSchemaPath
$bindingExample = Read-JsonUtf8 $bindingExamplePath

if ($null -in @($registry, $requestSchema, $knowledgeSchema, $bindingExample)) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

$workflows = @($registry.workflows)
$workflowCodes = @($workflows.code)
$expectedWorkflowCodes = @($requestSchema.'$defs'.workflow.properties.code.enum)
$taskTypes = @($requestSchema.'$defs'.task.properties.type.enum)
$profileCodes = @($registry.modelProfiles.code)
$allowedNodeTypes = @(
    'start', 'code', 'if_else', 'knowledge_retrieval', 'variable_aggregator',
    'llm', 'tool', 'iteration', 'template', 'output'
)
$allowedTools = @($registry.allowedToolCalls.code)
$knowledgeRequired = @($knowledgeSchema.required)
$bindingWorkflowCodes = @($bindingExample.workflows.PSObject.Properties.Name)

Add-FailureIfAny 'Duplicate workflow codes' @($workflowCodes | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name)
Add-FailureIfAny 'Registry workflow absent from AI request schema' @($workflowCodes | Where-Object { $_ -notin $expectedWorkflowCodes })
Add-FailureIfAny 'AI request workflow absent from registry' @($expectedWorkflowCodes | Where-Object { $_ -notin $workflowCodes })
Add-FailureIfAny 'Binding example workflow absent from registry' @($bindingWorkflowCodes | Where-Object { $_ -notin $workflowCodes })
Add-FailureIfAny 'Registry workflow absent from binding example' @($workflowCodes | Where-Object { $_ -notin $bindingWorkflowCodes })
Add-FailureIfAny 'Knowledge required metadata absent from schema' @($registry.knowledgePolicy.requiredMetadata | Where-Object { $_ -notin $knowledgeRequired })

foreach ($promptPath in @($registry.commonPromptFragments)) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $promptPath))) {
        $failures.Add("Missing common prompt: $promptPath")
    }
}

foreach ($workflow in $workflows) {
    Add-FailureIfAny "Unknown task type in $($workflow.code)" @($workflow.taskTypes | Where-Object { $_ -notin $taskTypes })

    foreach ($promptPath in @($workflow.promptFragments)) {
        if (-not (Test-Path -LiteralPath (Join-Path $root $promptPath))) {
            $failures.Add("Missing prompt for $($workflow.code): $promptPath")
        }
    }

    foreach ($property in @($workflow.outputSchemas.PSObject.Properties)) {
        $schemaPath = Join-Path $root $property.Value
        if (-not (Test-Path -LiteralPath $schemaPath)) {
            $failures.Add("Missing output schema for $($workflow.code): $($property.Value)")
        }
        if ($property.Name -notin @($workflow.outputTypes)) {
            $failures.Add("Output schema key not declared by $($workflow.code): $($property.Name)")
        }
    }

    $referencedProfiles = @()
    if ($workflow.modelProfile) { $referencedProfiles += $workflow.modelProfile }
    if ($workflow.modelProfileByTask) { $referencedProfiles += @($workflow.modelProfileByTask.PSObject.Properties.Value) }
    $referencedProfiles += @($workflow.nodes.modelProfile | Where-Object { $_ })
    Add-FailureIfAny "Unknown model profile in $($workflow.code)" @($referencedProfiles | Where-Object { $_ -notin $profileCodes })

    $nodeIds = @($workflow.nodes.id)
    Add-FailureIfAny "Duplicate node IDs in $($workflow.code)" @($nodeIds | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name)
    Add-FailureIfAny "Unknown node type in $($workflow.code)" @($workflow.nodes.type | Where-Object { $_ -notin $allowedNodeTypes })
    Add-FailureIfAny "Forbidden V1 node type in $($workflow.code)" @($workflow.nodes.type | Where-Object { $_ -in @('human_input', 'agent') })
    Add-FailureIfAny "Unknown tool in $($workflow.code)" @($workflow.nodes.toolCode | Where-Object { $_ -and $_ -notin $allowedTools })

    foreach ($edge in @($workflow.edges)) {
        if (@($edge).Count -ne 2) {
            $failures.Add("Invalid edge length in $($workflow.code)")
            continue
        }
        if ($edge[0] -notin $nodeIds) { $failures.Add("Unknown edge source in $($workflow.code): $($edge[0])") }
        if ($edge[1] -notin $nodeIds) { $failures.Add("Unknown edge target in $($workflow.code): $($edge[1])") }
    }
}

if ($registry.executionPolicy.humanInputNode -ne 'disabled_v1') {
    $failures.Add('Human Input node must remain disabled in V1')
}
if ($registry.executionPolicy.agentNode -ne 'disabled_v1') {
    $failures.Add('Agent node must remain disabled in V1')
}
if ($registry.executionPolicy.formalWriteTools -ne 'forbidden') {
    $failures.Add('Formal write tools must remain forbidden')
}
if ($registry.knowledgePolicy.difyKnowledgeScope -ne 'shared_official_sources_only') {
    $failures.Add('Dify knowledge scope must remain shared official sources only')
}
if ($registry.knowledgePolicy.dateFiltering -ne $false) {
    $failures.Add('Legal effective-date filtering must remain disabled')
}

$registryText = Get-Content -LiteralPath $registryPath -Raw -Encoding UTF8
if ($registryText -match 'tenant_id|dify_api_key"\s*:') {
    $failures.Add('Registry must not contain persistent tenant IDs or API key values')
}

foreach ($binding in @($bindingExample.workflows.PSObject.Properties.Value)) {
    if ($binding.api_key_secret_ref -notmatch '^secret://') {
        $failures.Add('Dify API key binding must be a secret reference')
    }
    if ($binding.dify_app_id -notmatch '^\$\{[A-Z0-9_]+\}$') {
        $failures.Add('Dify App ID in example must remain an environment placeholder')
    }
}

if ($workflows.Count -ne 6) {
    $failures.Add("Expected 6 workflows, actual $($workflows.Count)")
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

$nodeCount = @($workflows.nodes | ForEach-Object { $_ }).Count
[pscustomobject]@{
    Status = 'PASS'
    Workflows = $workflows.Count
    ModelProfiles = $profileCodes.Count
    Nodes = $nodeCount
    Prompts = @(Get-ChildItem -LiteralPath (Join-Path $root 'prompts') -File -Filter '*.md').Count
    BindingWorkflows = $bindingWorkflowCodes.Count
    Message = 'Workflow codes, tasks, prompts, schemas, models, nodes, edges, and V1 safety policies passed'
} | Format-List
