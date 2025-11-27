function Copy-PluginFiles {
    param(
        [string]$vaultDir
    )
    if (-not (Test-Path $vaultDir -PathType Container)) {
        "Vault path not found on this computer." | Write-Host -ForegroundColor Red
        return
    }

    $extensionDir = $vaultDir | Join-Path -ChildPath ".obsidian\plugins\obsidian-weekly-note"
    if (-not (Test-Path $extensionDir -PathType Container)) {
        New-Item $extensionDir -ItemType Directory
    }
    Get-ChildItem $PSScriptRoot | Where-Object {$_.Name -in @("main.js", "styles.css", "manifest.json")} | Copy-Item -Destination $extensionDir
}

if ((Get-Command npm -ErrorAction SilentlyContinue).Source -eq "") {
    "npm not found on this computer." | Write-Error
}
else {
    npm install
    if ($LASTEXITCODE -eq 0) {
        npm run build
        if ($LASTEXITCODE -eq 0) {
            Copy-PluginFiles -vaultDir $args[0]
        }
    }
}
