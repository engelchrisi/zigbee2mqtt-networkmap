# checkin.ps1 - Commit and push changes to zigbee2mqtt-networkmap via SSH to the dev host
#
# Git against the Windows UNC share hangs and produces spurious whole-file
# CRLF/LF diffs (Windows core.autocrlf differs from the Unix checkout), so
# this runs git entirely over SSH on the host where the repo actually lives.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File "\\192.168.20.143\zigbee2mqtt-networkmap\checkin.ps1" -Message "Fix foo"
#
# Only files with real (non-line-ending-only) changes are staged; files that
# differ solely by CRLF/LF (--ignore-space-at-eol shows no diff) are skipped
# automatically so stray Windows-side touches don't get committed.
# After committing, the branch is pushed to origin.

param(
    [Parameter(Mandatory = $true)]
    [string]$Message
)

$SshHost   = "engelch@192.168.20.143"
$RepoPath  = "~/dev/zigbee2mqtt-networkmap"
$GitEmail  = "christof_sp1@lin-engel.de"
$GitName   = "engelchrisi"

$b64Message = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Message))

$remoteScript = @'
set -e
cd __REPO__

git config user.email "__EMAIL__" >/dev/null
git config user.name "__NAME__" >/dev/null

echo "Scanning for real (non-line-ending) changes..."
real_files=()
for f in $(git diff --name-only; git diff --cached --name-only | sort -u); do
    if [ -n "$(git diff --ignore-space-at-eol -- "$f")" ]; then
        real_files+=("$f")
    fi
done
while IFS= read -r f; do
    [ -n "$f" ] && real_files+=("$f")
done < <(git ls-files --others --exclude-standard)

if [ ${#real_files[@]} -eq 0 ]; then
    echo "No real changes to commit (only line-ending noise, or nothing changed)."
    git status
    exit 0
fi

echo "Staging:"
printf '  %s\n' "${real_files[@]}"
git add -- "${real_files[@]}"

msg=$(echo "__MSGB64__" | base64 -d)
git commit -m "$msg

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"

echo "Pushing to origin..."
git push

git status
'@

$remoteScript = $remoteScript.Replace("__REPO__", $RepoPath)
$remoteScript = $remoteScript.Replace("__EMAIL__", $GitEmail)
$remoteScript = $remoteScript.Replace("__NAME__", $GitName)
$remoteScript = $remoteScript.Replace("__MSGB64__", $b64Message)
$remoteScript = $remoteScript -replace "`r`n", "`n"

Write-Host "Committing and pushing via SSH on $SshHost ..." -ForegroundColor Cyan

# Write to a temp file (no BOM) and redirect it into ssh's stdin at the OS
# level. Piping a .NET string through Process.StandardInput on Windows
# PowerShell (.NET Framework) silently prepends a UTF-8 BOM, which bash
# then attaches to the first token of the script - avoid that entirely.
$tmpFile = [System.IO.Path]::GetTempFileName()
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tmpFile, $remoteScript, $utf8NoBom)

cmd /c "ssh $SshHost `"bash -s`" < `"$tmpFile`""
$exitCode = $LASTEXITCODE

Remove-Item $tmpFile -Force

if ($exitCode -ne 0) {
    Write-Host "Commit/push failed." -ForegroundColor Red
    exit 1
}

Write-Host "Done." -ForegroundColor Green
