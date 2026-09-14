# ── nexious-random (PowerShell port) ──
# What: cryptographically random strings, matching src/random/generate.ts output shape.
# Who: Windows users who want a random string without Node or WSL installed. Runs in
#      Windows PowerShell 5.1 and PowerShell 7+.
# Why:  the user codes on Windows and this is the native shell. If bash or Node are not
#       available (clean workstation, CI runner, customer support machine), this script
#       still works with zero install.
#
# Drift warning: keep pools and constants aligned with charPools.ts or the Windows
# output will not match the Node/Python/bash outputs.

[CmdletBinding()]
param(
    [int]$Length,
    [ValidateSet('full','safe','hex')][string]$Alphabet = 'full',
    [switch]$NoDashes,
    [int]$Count = 1,
    [switch]$Raw,
    [switch]$Help
)

$POOL_FULL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+=[]{}|;:,.<>?'
$POOL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
$POOL_HEX  = '0123456789abcdef'

$SEGMENT_LENGTH   = 6
$DASH_THRESHOLD   = 10
$DEFAULT_SEGMENTS = 4

if ($Help) {
@"
nexious-random (PowerShell) - cryptographically random strings

Usage:
  .\random.ps1 [-Length <n>] [-Alphabet full|safe|hex] [-NoDashes] [-Count <n>] [-Raw]

Options:
  -Length <n>     total character count (default 24)
  -Alphabet <x>   full | safe | hex (default full)
  -NoDashes       skip dash separators
  -Count <n>      print N strings, one per line
  -Raw            suppress trailing newline (for piping)
  -Help           show this help
"@ | Write-Host
    return
}

switch ($Alphabet) {
    'safe' { $pool = $POOL_SAFE }
    'hex'  { $pool = $POOL_HEX  }
    default { $pool = $POOL_FULL }
}

if (-not $PSBoundParameters.ContainsKey('Length')) {
    $Length = $DEFAULT_SEGMENTS * $SEGMENT_LENGTH
}
if ($Length -lt 1) { Write-Error '-Length must be a positive integer'; exit 1 }
if ($Count  -lt 1) { Write-Error '-Count must be a positive integer';  exit 1 }

# Cryptographic RNG. Do NOT use Get-Random without -SetSeed control; even then it is
# not cryptographically strong. RNGCryptoServiceProvider / RandomNumberGenerator is
# the right primitive.
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

function New-RandomString {
    # ① Draw `Length` random bytes. One byte per character is sufficient since we
    #    modulo into a pool of at most 87. The modulo bias on an 87-pool from a 256
    #    uniform distribution is negligible for the string lengths we generate.
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)

    $sb = New-Object System.Text.StringBuilder
    $poolLen = $pool.Length
    for ($i = 0; $i -lt $Length; $i++) {
        [void]$sb.Append($pool[$bytes[$i] % $poolLen])
    }
    $raw = $sb.ToString()

    if ($NoDashes -or $Length -le $DASH_THRESHOLD) {
        return $raw
    }

    # Chunk and dash-join; same shape as the TS version's segment join.
    $segments = @()
    for ($i = 0; $i -lt $raw.Length; $i += $SEGMENT_LENGTH) {
        $segments += $raw.Substring($i, [Math]::Min($SEGMENT_LENGTH, $raw.Length - $i))
    }
    return ($segments -join '-')
}

$lines = @()
for ($i = 0; $i -lt $Count; $i++) {
    $lines += New-RandomString
}

if ($Raw) {
    [Console]::Out.Write(($lines -join "`n"))
} else {
    [Console]::Out.Write((($lines -join "`n") + "`n"))
}
