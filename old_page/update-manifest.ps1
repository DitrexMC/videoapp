# update-manifest.ps1
# pages/ フォルダ内のすべての HTML ページからフロントマターを読み取り、
# pages/manifest.json を自動生成・更新するスクリプトです。
#
# 使い方:
#   .\update-manifest.ps1
#
# 新しい記事ページを pages/ に追加したら、このスクリプトを1回実行するだけで
# News ページや index.html の最新情報フィードが自動的に更新されます。

$pagesDir = Join-Path $PSScriptRoot "pages"
$manifestPath = Join-Path $pagesDir "manifest.json"

# テンプレートファイルは除外
$htmlFiles = Get-ChildItem -Path $pagesDir -Filter "*.html" | Where-Object { $_.Name -ne "_template.html" }

$manifest = @()

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8

    # <script id="md-source" type="text/plain"> タグ内を抽出
    $scriptMatch = [regex]::Match($content, '<script\s+id="md-source"\s+type="text/plain">([\s\S]*?)</script>')
    if (-not $scriptMatch.Success) {
        Write-Warning "md-source が見つかりません: $($file.Name)"
        continue
    }

    $mdContent = $scriptMatch.Groups[1].Value.Trim()

    # フロントマター (--- ... ---) を抽出
    $fmMatch = [regex]::Match($mdContent, '^---\r?\n([\s\S]*?)\r?\n---')
    if (-not $fmMatch.Success) {
        Write-Warning "フロントマターが見つかりません: $($file.Name)"
        continue
    }

    $fmContent = $fmMatch.Groups[1].Value
    $meta = @{}

    foreach ($line in ($fmContent -split "`r?`n")) {
        $ci = $line.IndexOf(':')
        if ($ci -gt -1) {
            $key   = $line.Substring(0, $ci).Trim()
            $value = $line.Substring($ci + 1).Trim()
            $meta[$key] = $value
        }
    }

    $manifest += [ordered]@{
        url      = "pages/$($file.Name)"
        title    = if ($meta['title'])    { $meta['title'] }    else { $file.BaseName }
        type     = if ($meta['type'])     { $meta['type'] }     else { 'News' }
        date     = if ($meta['date'])     { $meta['date'] }     else { '2000-01-01' }
        subtitle = if ($meta['subtitle']) { $meta['subtitle'] } else { '' }
        tags     = if ($meta['tags'])     { $meta['tags'] }     else { '' }
        image    = if ($meta['image'])    { $meta['image'] }    else { '' }
    }
}

# 日付の新しい順にソート
$manifest = $manifest | Sort-Object { [datetime]$_.date } -Descending

$manifest | ConvertTo-Json -Depth 3 | Set-Content $manifestPath -Encoding UTF8

Write-Host "✅ manifest.json を更新しました ($($manifest.Count) 件)" -ForegroundColor Green
