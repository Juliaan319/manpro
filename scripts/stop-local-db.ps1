param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin')
$workspace = Split-Path -Parent $PSScriptRoot
& (Join-Path $PostgresBin 'pg_ctl.exe') -D (Join-Path $workspace '.local\postgres') stop -m fast
