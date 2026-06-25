# 自动同步到 GitHub 的脚本
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$message = "Auto update: $date"

Write-Host "开始同步到 GitHub..." -ForegroundColor Cyan

# 添加所有更改
git add .

# 提交更改 (如果没有更改则跳过)
$status = git status --porcelain
if ($status) {
    git commit -m $message
    Write-Host "已提交更改: $message" -ForegroundColor Green
} else {
    Write-Host "没有检测到需要提交的更改。" -ForegroundColor Yellow
}

# 推送到远程仓库
Write-Host "正在推送..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "同步成功！" -ForegroundColor Green
} else {
    Write-Host "同步失败，请检查网络连接或权限。" -ForegroundColor Red
}

Read-Host "按回车键退出..."
