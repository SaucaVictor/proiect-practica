# start-audio-server.ps1
# Kills any process holding port 8001, then starts the ClassMonitor audio server.
# Usage: npm run audio-server

$PORT = 8001
$SERVER_SCRIPT = "servers\audio-server\server.py"

Write-Host ""
Write-Host "==> ClassMonitor Audio Server" -ForegroundColor Cyan
Write-Host "    Checking port $PORT..." -ForegroundColor Gray

# Find and kill any process currently using the port
# Note: avoid $pid — it is a PowerShell automatic variable (current process ID)
$connections = Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue
$ownerPids = $connections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 }

if ($ownerPids) {
    foreach ($procId in $ownerPids) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "    Killing '$($proc.Name)' (PID $procId) on port $PORT..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 700   # give the OS time to release the socket
    Write-Host "    Port $PORT is now free." -ForegroundColor Green
} else {
    Write-Host "    Port $PORT is free." -ForegroundColor Green
}

Write-Host ""
Write-Host "==> Starting audio server: python $SERVER_SCRIPT" -ForegroundColor Cyan
Write-Host ""

python -u $SERVER_SCRIPT $args
