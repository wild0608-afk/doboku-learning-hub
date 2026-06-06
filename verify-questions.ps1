#Requires -Version 5.0
<#
.SYNOPSIS
    1級土木施工管理 Learning Hub - 問題データ検証スクリプト (Level 1)
    PowerShell 単体動作 / Node.js 不要 / 正規表現ベース

.DESCRIPTION
    questions-doboku-a.js / questions-doboku-b.js / questions-doboku-c.js / questions-doboku-d.js
    をテキストとして読み込み、正規表現で以下を検証します。
      1. ファイル存在確認
      2. ファイルごとの id 数カウント
      3. 全ファイル横断 id 重複チェック
      4. question 存在数カウント・空文字チェック
      5. options 存在数カウント・選択肢数/空文字/重複チェック
      6. correct 存在数カウント・値範囲チェック（整数 0〜3）
      7. explanation 存在数カウント・空文字チェック
      8. verified 存在数カウント・boolean 値チェック（新形式ID必須）
      9. カテゴリ名の出現数集計
     10. 総問題数表示
     11. 新形式ID（TK-YYYY-NNNN）の形式チェック

    ID は文字列として扱います（parseInt 禁止）。
    問題データの自動修正は行いません。検出と報告のみ。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\verify-questions.ps1
#>

param()

# 日本語表示のためコンソールを UTF-8 に設定
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($ScriptDir)) { $ScriptDir = (Get-Location).Path }

$AllErrors   = [System.Collections.Generic.List[string]]::new()
$AllWarnings = [System.Collections.Generic.List[string]]::new()

function Add-Error([string]$msg)   { $script:AllErrors.Add($msg) }
function Add-Warning([string]$msg) { $script:AllWarnings.Add($msg) }

$TargetFiles = @(
    "questions-doboku-a.js",
    "questions-doboku-b.js",
    "questions-doboku-c.js",
    "questions-doboku-d.js"
)

# ──────────────────────────────────────────────────────────────────────
# ヘッダー
# ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  1級土木施工管理 Learning Hub - 問題データ検証スクリプト (Level 1)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PowerShell 単体動作 / Node.js 不要" -ForegroundColor DarkGray
Write-Host "  実行: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host "  場所: $ScriptDir" -ForegroundColor DarkGray
Write-Host ""

# ──────────────────────────────────────────────────────────────────────
# Step 1: ファイル存在確認
# ──────────────────────────────────────────────────────────────────────
Write-Host "[ Step 1: ファイル存在確認 ]" -ForegroundColor Yellow

$FileContents = @{}
foreach ($fileName in $TargetFiles) {
    $filePath = Join-Path $ScriptDir $fileName
    if (-not (Test-Path $filePath)) {
        Write-Host "  ERROR: 存在しない: $fileName" -ForegroundColor Red
        Add-Error "ファイルが存在しません: $fileName"
        $FileContents[$fileName] = $null
    } else {
        Write-Host "  OK   : $fileName" -ForegroundColor Green
        $FileContents[$fileName] = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    }
}
Write-Host ""

# ──────────────────────────────────────────────────────────────────────
# Step 2: ファイルごとの正規表現解析
# ──────────────────────────────────────────────────────────────────────
Write-Host "[ Step 2: ファイルごとの正規表現解析 ]" -ForegroundColor Yellow

$AllIdsWithFile = @()   # { Id; File } の配列（横断 ID チェック用）
$FileSummaries  = @{}   # ファイル名 → 各カウント
$GlobalCatMap   = @{}   # カテゴリ名 → 総出現数

foreach ($fileName in $TargetFiles) {
    $content = $FileContents[$fileName]
    if ($null -eq $content) { continue }

    # 行頭が // のコメント行を除去してから解析する
    $clean = ($content -split "`n" |
              Where-Object { $_ -notmatch '^\s*//' }) -join "`n"

    # ── ID 抽出（必ず文字列として保持する・parseInt 禁止）
    # 文字列 ID: id: "TK-2026-0001"
    $strIdMs  = [System.Text.RegularExpressions.Regex]::Matches(
                    $clean, '(?m)^\s+id\s*:\s*"([^"]+)"')
    # 整数 ID:   id: 3
    $intIdMs  = [System.Text.RegularExpressions.Regex]::Matches(
                    $clean, '(?m)^\s+id\s*:\s*(\d+)')

    $fileIds = @()
    foreach ($m in $strIdMs) { $fileIds += $m.Groups[1].Value }   # 文字列のまま
    foreach ($m in $intIdMs) { $fileIds += $m.Groups[1].Value }   # 数字も文字列として保持

    foreach ($idVal in $fileIds) {
        $AllIdsWithFile += [PSCustomObject]@{ Id = $idVal; File = $fileName }
    }

    # ── 各フィールドの出現数（行頭 + フィールド名で正確にマッチ）
    $qCount   = ([System.Text.RegularExpressions.Regex]::Matches(
                    $clean, '(?m)^\s+question\s*:')).Count
    $optCount = ([System.Text.RegularExpressions.Regex]::Matches(
                    $clean, '(?m)^\s+options\s*:')).Count
    $corCount = ([System.Text.RegularExpressions.Regex]::Matches(
                    $clean, '(?m)^\s+correct\s*:')).Count
    $expCount = ([System.Text.RegularExpressions.Regex]::Matches(
                    $clean, '(?m)^\s+explanation\s*:')).Count
    $verCount = ([System.Text.RegularExpressions.Regex]::Matches(
                    $clean, '(?m)^\s+verified\s*:')).Count

    # ── カテゴリ抽出
    # ダブルクォート: category: "宅建業法"
    $catDQ = [System.Text.RegularExpressions.Regex]::Matches(
                 $clean, '(?m)^\s+category\s*:\s*"([^"]+)"')
    # シングルクォート: category: '宅建業法'
    $catSQ = [System.Text.RegularExpressions.Regex]::Matches(
                 $clean, "(?m)^\s+category\s*:\s*'([^']+)'")

    $catCount = $catDQ.Count + $catSQ.Count
    foreach ($m in $catDQ) {
        $c = $m.Groups[1].Value
        if (-not $GlobalCatMap.ContainsKey($c)) { $GlobalCatMap[$c] = 0 }
        $GlobalCatMap[$c]++
    }
    foreach ($m in $catSQ) {
        $c = $m.Groups[1].Value
        if (-not $GlobalCatMap.ContainsKey($c)) { $GlobalCatMap[$c] = 0 }
        $GlobalCatMap[$c]++
    }

    # ── 旧形式 / 新形式 ID の内訳
    $newIdCnt = @($fileIds | Where-Object { $_ -match '^DK-' }).Count
    $oldIdCnt = $fileIds.Count - $newIdCnt

    $FileSummaries[$fileName] = @{
        IdCount  = $fileIds.Count
        NewIdCnt = $newIdCnt
        OldIdCnt = $oldIdCnt
        QCount   = $qCount
        OptCount = $optCount
        CorCount = $corCount
        ExpCount = $expCount
        VerCount = $verCount
        CatCount = $catCount
    }

    # ── 表示
    Write-Host ""
    Write-Host "  ── $fileName ──" -ForegroundColor Cyan
    Write-Host ("    id 数 (合計)          : {0,3}  (DK-形式: {1}  旧形式: {2})" `
                -f $fileIds.Count, $newIdCnt, $oldIdCnt) -ForegroundColor White
    Write-Host ("    question 数           : {0,3}" -f $qCount)   -ForegroundColor White
    Write-Host ("    options 数            : {0,3}" -f $optCount) -ForegroundColor White
    Write-Host ("    correct 数            : {0,3}" -f $corCount) -ForegroundColor White
    Write-Host ("    explanation 数        : {0,3}" -f $expCount) -ForegroundColor White
    Write-Host ("    verified 数           : {0,3}  (DK-形式 {1} 問が期待値)" `
                -f $verCount, $newIdCnt) -ForegroundColor White
    Write-Host ("    category 出現数       : {0,3}" -f $catCount) -ForegroundColor White

    # ── 整合性チェック（id 数を基準に各フィールドと比較）
    $base = $fileIds.Count
    if ($qCount   -ne $base) { Add-Error "$fileName : id 数($base) と question 数($qCount) が一致しません" }
    if ($optCount -ne $base) { Add-Error "$fileName : id 数($base) と options 数($optCount) が一致しません" }
    if ($corCount -ne $base) { Add-Error "$fileName : id 数($base) と correct 数($corCount) が一致しません" }
    if ($expCount -ne $base) { Add-Error "$fileName : id 数($base) と explanation 数($expCount) が一致しません" }

    # verified は TK-形式ID 問にのみ必須（不足はエラー）
    if ($verCount -lt $newIdCnt) {
        Add-Error "$fileName : verified 数($verCount) が DK-形式ID 数($newIdCnt) より少ない（新形式IDには verified が必須）"
    }
    if ($oldIdCnt -gt 0) {
        Write-Host ("    ※ 旧形式ID {0} 問には verified なし（仕様通り）" -f $oldIdCnt) -ForegroundColor DarkGray
    }

    # ── 新形式ID 形式チェック（^DK-\d{4}-\d{4}$ 以外はエラー）
    foreach ($idVal in $fileIds) {
        if ($idVal -match '^DK') {
            if ($idVal -notmatch '^DK-\d{4}-\d{4}$') {
                Add-Error "$fileName : 新形式IDの形式が不正です: '$idVal' (DK-YYYY-NNNN 形式であるべき)"
            }
        }
    }

    # ── options 値チェック（選択肢数 / 空文字 / 重複）
    $optBlocks = [System.Text.RegularExpressions.Regex]::Matches(
                     $clean, 'options\s*:\s*\[([\s\S]*?)\]')
    $optBlockIdx = 0
    foreach ($blk in $optBlocks) {
        $optBlockIdx++
        $blkContent = $blk.Groups[1].Value
        $dqItems = [System.Text.RegularExpressions.Regex]::Matches($blkContent, '"([^"]*)"')
        $sqItems = [System.Text.RegularExpressions.Regex]::Matches($blkContent, "'([^']*)'")
        $allOptItems = [System.Collections.Generic.List[string]]::new()
        foreach ($m in $dqItems) { $allOptItems.Add($m.Groups[1].Value) }
        foreach ($m in $sqItems) { $allOptItems.Add($m.Groups[1].Value) }

        if ($allOptItems.Count -ne 4) {
            Add-Error "$fileName : options[$optBlockIdx] の選択肢が $($allOptItems.Count) 個です（4個であるべき）"
        }
        $emptyFound = $false
        foreach ($item in $allOptItems) {
            if ([string]::IsNullOrWhiteSpace($item)) { $emptyFound = $true; break }
        }
        if ($emptyFound) {
            Add-Error "$fileName : options[$optBlockIdx] に空文字または空白のみの選択肢があります"
        }
        $uniqueItems = $allOptItems | Select-Object -Unique
        if ($uniqueItems.Count -ne $allOptItems.Count) {
            Add-Error "$fileName : options[$optBlockIdx] に重複した選択肢があります"
        }
    }

    # ── correct 値チェック（0〜3 の整数であるべき）
    $correctValMatches = [System.Text.RegularExpressions.Regex]::Matches(
                             $clean, '(?m)^\s+correct\s*:\s*(.+)')
    foreach ($m in $correctValMatches) {
        $val = $m.Groups[1].Value.Trim() -replace '//.*$', ''
        $val = $val.TrimEnd(',').Trim()
        if ($val -notmatch '^[0-3]$') {
            Add-Error "$fileName : correct の値が無効です: '$val' （整数 0, 1, 2, 3 のいずれかであるべき）"
        }
    }

    # ── question / explanation 空文字チェック
    foreach ($fld in @('question', 'explanation')) {
        $patternDQ = '(?m)^\s+' + $fld + '\s*:\s*"([^"]*)"'
        $patternSQ = "(?m)^\s+" + $fld + "\s*:\s*'([^']*)'"
        $fldDQMatches = [System.Text.RegularExpressions.Regex]::Matches($clean, $patternDQ)
        $fldSQMatches = [System.Text.RegularExpressions.Regex]::Matches($clean, $patternSQ)
        foreach ($m in $fldDQMatches) {
            if ([string]::IsNullOrWhiteSpace($m.Groups[1].Value)) {
                Add-Error "$fileName : $fld が空文字または空白のみです"
            }
        }
        foreach ($m in $fldSQMatches) {
            if ([string]::IsNullOrWhiteSpace($m.Groups[1].Value)) {
                Add-Error "$fileName : $fld が空文字または空白のみです"
            }
        }
    }

    # ── verified 値チェック（boolean の true / false であるべき）
    $verifiedValMatches = [System.Text.RegularExpressions.Regex]::Matches(
                              $clean, '(?m)^\s+verified\s*:\s*(.+)')
    foreach ($m in $verifiedValMatches) {
        $val = $m.Groups[1].Value.Trim() -replace '//.*$', ''
        $val = $val.TrimEnd(',').Trim()
        if ($val -notmatch '^(true|false)$') {
            Add-Error "$fileName : verified の値が boolean ではありません: '$val' （true または false であるべき）"
        }
    }
}
Write-Host ""

# ──────────────────────────────────────────────────────────────────────
# Step 3: ファイルごとの問題数（id 数）
# ──────────────────────────────────────────────────────────────────────
Write-Host "[ Step 3: ファイルごとの問題数 ]" -ForegroundColor Yellow
$totalIdCount = 0
foreach ($fileName in $TargetFiles) {
    $info = $FileSummaries[$fileName]
    if ($null -eq $info) {
        Write-Host ("  {0,-34}: 読み込み失敗" -f $fileName) -ForegroundColor Red
    } else {
        Write-Host ("  {0,-34}: {1,3} 問" -f $fileName, $info.IdCount) -ForegroundColor White
        $totalIdCount += $info.IdCount
    }
}
Write-Host ("  {0,-34}: {1,3} 問（合計）" -f "--------------------------------", $totalIdCount) -ForegroundColor Cyan
Write-Host ""

# ──────────────────────────────────────────────────────────────────────
# Step 4: カテゴリ別問題数
# ──────────────────────────────────────────────────────────────────────
Write-Host "[ Step 4: カテゴリ別問題数 ]" -ForegroundColor Yellow
if ($GlobalCatMap.Count -gt 0) {
    foreach ($cat in ($GlobalCatMap.Keys | Sort-Object)) {
        Write-Host ("  {0,-20}: {1,3} 問" -f $cat, $GlobalCatMap[$cat]) -ForegroundColor White
    }
} else {
    Write-Host "  （カテゴリ情報なし）" -ForegroundColor DarkGray
}
Write-Host ""

# ──────────────────────────────────────────────────────────────────────
# Step 5: ID 重複チェック（全ファイル横断）
# ──────────────────────────────────────────────────────────────────────
Write-Host "[ Step 5: ID 重複チェック（全ファイル横断）]" -ForegroundColor Yellow
$seenIds  = @{}
$dupCount = 0
foreach ($entry in $AllIdsWithFile) {
    $idStr = $entry.Id   # 文字列として扱う（parseInt 禁止）
    if ($seenIds.ContainsKey($idStr)) {
        Add-Error "ID が重複しています: '$idStr'  初出: $($seenIds[$idStr])  再出: $($entry.File)"
        $dupCount++
    } else {
        $seenIds[$idStr] = $entry.File
    }
}

if ($dupCount -eq 0) {
    Write-Host "  OK   : 重複なし（全 $($AllIdsWithFile.Count) ID を確認）" -ForegroundColor Green
} else {
    Write-Host "  ERROR: 重複 $dupCount 件を検出" -ForegroundColor Red
}
Write-Host ""

# ──────────────────────────────────────────────────────────────────────
# 結果出力
# ──────────────────────────────────────────────────────────────────────
Write-Host "[ 検証結果サマリー ]" -ForegroundColor Yellow
Write-Host "  ----------------------------------------------------------------" -ForegroundColor DarkGray
$errColor  = if ($AllErrors.Count   -gt 0) { "Red"         } else { "Green" }
$warnColor = if ($AllWarnings.Count -gt 0) { "DarkYellow"  } else { "White"  }
Write-Host ("  総問題数（id 数）: {0,3} 問" -f $totalIdCount)    -ForegroundColor White
Write-Host ("  エラー数         : {0,3} 件" -f $AllErrors.Count)  -ForegroundColor $errColor
Write-Host ("  警告数           : {0,3} 件" -f $AllWarnings.Count) -ForegroundColor $warnColor
Write-Host "  ----------------------------------------------------------------" -ForegroundColor DarkGray

if ($AllWarnings.Count -gt 0) {
    Write-Host ""
    Write-Host "  警告一覧 ($($AllWarnings.Count) 件):" -ForegroundColor DarkYellow
    foreach ($w in $AllWarnings) {
        Write-Host "    [WARN ] $w" -ForegroundColor DarkYellow
    }
}

if ($AllErrors.Count -gt 0) {
    Write-Host ""
    Write-Host "  エラー一覧 ($($AllErrors.Count) 件):" -ForegroundColor Red
    foreach ($e in $AllErrors) {
        Write-Host "    [ERROR] $e" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "  ================================================================" -ForegroundColor Red
    Write-Host "  FAIL : 検証失敗 - エラー $($AllErrors.Count) 件" -ForegroundColor Red
    Write-Host "  ================================================================" -ForegroundColor Red
    Write-Host ""
    exit 1
} else {
    Write-Host ""
    Write-Host "  ================================================================" -ForegroundColor Green
    Write-Host "  OK   : 検証クリア - エラーなし" -ForegroundColor Green
    if ($AllWarnings.Count -gt 0) {
        Write-Host "  ※ 警告 $($AllWarnings.Count) 件あり（修正は任意）" -ForegroundColor DarkYellow
    }
    Write-Host "  ================================================================" -ForegroundColor Green
    Write-Host ""
    exit 0
}
