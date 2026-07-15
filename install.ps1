# Unturned Mods CLI - Windows PowerShell Installer
$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "     Unturned Mods CLI Installer         " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check if Bun is installed
$bunPath = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bunPath) {
    Write-Host "[Error] Bun is not installed or not in your PATH." -ForegroundColor Red
    Write-Host "Unturned Mods CLI requires Bun (a fast JavaScript/TypeScript runtime)." -ForegroundColor Yellow
    Write-Host "To install Bun, run the following command in PowerShell:" -ForegroundColor Yellow
    Write-Host "    powershell -c ""irm bun.sh/install.ps1 | iex""" -ForegroundColor Cyan
    Write-Host "After installing Bun, please restart your terminal and run this installer again." -ForegroundColor Yellow
    Exit 1
}

Write-Host "[1/3] Bun detected: $($bunPath.Source)" -ForegroundColor Green

# 2. Install dependencies
Write-Host "[2/3] Installing dependencies..." -ForegroundColor Green
bun install

# 3. Compile binary
Write-Host "[3/3] Compiling standalone executable..." -ForegroundColor Green
$binaryName = "utmod.exe"
bun build --compile .\src\index.ts --outfile .\$binaryName

if (-not (Test-Path .\$binaryName)) {
    Write-Host "[Error] Compilation failed! No executable was created." -ForegroundColor Red
    Exit 1
}

# 4. Install to global PATH
$bunBinDir = Join-Path $env:USERPROFILE ".bun\bin"
if (-not (Test-Path $bunBinDir)) {
    Write-Host "Creating Bun global bin directory at $bunBinDir..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $bunBinDir | Out-Null
}

$destPath = Join-Path $bunBinDir $binaryName
Write-Host "Installing $binaryName to $destPath..." -ForegroundColor Green
Copy-Item -Path .\$binaryName -Destination $destPath -Force

# Clean up local build output
Remove-Item -Path .\$binaryName -ErrorAction SilentlyContinue

# Ensure PATH has the directory
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$bunBinPattern = [regex]::Escape($bunBinDir)
if ($userPath -notmatch $bunBinPattern) {
    Write-Host "Adding $bunBinDir to your User PATH variable..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$bunBinDir", "User")
    Write-Host "Successfully updated PATH. Please restart your terminal/IDE for the changes to take effect." -ForegroundColor Green
}

Write-Host "`n=== Installation Complete! ===" -ForegroundColor Green
Write-Host "You can now run the CLI using: utmod" -ForegroundColor Cyan
Write-Host "Try running: utmod --help" -ForegroundColor Cyan
