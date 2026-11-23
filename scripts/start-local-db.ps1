param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$cluster = Join-Path $workspace '.local\postgres'
New-Item -ItemType Directory -Force (Join-Path $workspace '.local') | Out-Null
if (!(Test-Path (Join-Path $PostgresBin 'initdb.exe'))) { throw 'PostgreSQL tidak ditemukan. Berikan -PostgresBin yang sesuai.' }
if (!(Test-Path (Join-Path $cluster 'PG_VERSION'))) {
    & (Join-Path $PostgresBin 'initdb.exe') -D $cluster -U labtrack -A trust -E UTF8
    if ($LASTEXITCODE -ne 0) { throw 'Inisialisasi PostgreSQL gagal.' }
}
& (Join-Path $PostgresBin 'pg_ctl.exe') -D $cluster status
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $PostgresBin 'pg_ctl.exe') -D $cluster -l (Join-Path $workspace '.local\postgres.log') -o '-p 55432 -h 127.0.0.1' start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL gagal dimulai.' }
}
$exists = & (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p 55432 -U labtrack -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='labtrack'"
if ($exists -ne '1') { & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p 55432 -U labtrack labtrack }
Write-Host 'PostgreSQL pengembangan aktif di 127.0.0.1:55432. Autentikasi trust hanya untuk pengembangan lokal.'
