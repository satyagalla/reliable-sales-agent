param([Parameter(ValueFromRemainingArguments=$true)][string[]]$TaskArgs)
$ErrorActionPreference='Stop'
$localNode=Get-ChildItem -LiteralPath "$PSScriptRoot/../.tools" -Directory -ErrorAction SilentlyContinue | Where-Object Name -Like 'node-*-win-x64' | Select-Object -First 1
if ($localNode) { $env:Path=$localNode.FullName+';'+$env:Path }
& npm.cmd @TaskArgs
exit $LASTEXITCODE
