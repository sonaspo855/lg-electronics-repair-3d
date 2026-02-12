# 1. Ollama 서버 창
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama serve" -WindowStyle Normal

# 2. npm dev 서버 창 (작업 디렉토리 지정)
Start-Process powershell -ArgumentList "-NoExit", "-WorkingDirectory", "H:\Workspace\WORK\Workspace\Git-repo\lg-electronics-repair-3d", "-Command", "npm run dev" -WindowStyle Normal

# 3. Gemini CLI 전용 창
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
function Start-Gemini { gemini `$args }
Set-Alias -Name g -Value Start-Gemini -Scope Global
Write-Host '=== Gemini CLI Ready! ===' -ForegroundColor Cyan
Write-Host 'g `"question`" Enter!!' -ForegroundColor Green
Write-Host 'Exit with exit' -ForegroundColor Yellow

# 자동으로 실행되게 하려면 아래 줄을 추가하세요
Start-Gemini 
"@ -WindowStyle Normal
