# Takken Learning Hub 問題データ規格 v1.0

このドキュメントは、Takken Learning Hub の問題追加・検証・AI分業運用のための基準です。

---

## 1. 基本方針

Takken Learning Hub は、最初は個人学習用MVPとして運用し、将来的には以下の状態を目指す。

- 問題数100問 → 300問 → 500問へ段階拡張
- AI生成問題と公式確認済み問題を明確に分離
- 問題IDを永続化し、学習履歴との整合性を守る
- topic / tags によって重複・類似問題を管理する
- RETIO、e-Gov、国土交通省資料、公式過去問等でファクトチェックできる構造にする

---

## 2. 既存問題の扱い

現在の `questions.js` には、整数IDの既存問題が存在する。

例：

```js
id: 1
id: 2
id: 3
```

既存IDは localStorage の学習履歴と紐づく可能性があるため、原則として変更しない。

今後追加する新規問題から、文字列ID形式へ移行する。

---

## 3. 新規問題IDルール

新規追加問題は以下の形式を使う。

```txt
TK-2026-0001
TK-2026-0002
TK-2026-0003
```

### 絶対ルール

- IDは絶対に重複させない
- 一度使ったIDは変更しない
- 削除した問題のIDも再利用しない
- 分野が違っても通し番号で管理する
- AIに問題生成させる時は、必ず開始IDと終了IDを指定する

例：

```txt
Set 1: TK-2026-0001 〜 TK-2026-0025
Set 2: TK-2026-0026 〜 TK-2026-0050
Set 3: TK-2026-0051 〜 TK-2026-0075
Set 4: TK-2026-0076 〜 TK-2026-0100
```

---

## 4. 新規問題データ形式

今後の新規問題は以下の形式を標準とする。

```js
{
  id: "TK-2026-0001",
  category: "宅建業法",
  topic: "免許制度",
  tags: ["宅建業者", "免許", "国土交通大臣", "都道府県知事"],

  question: "宅地建物取引業の免許に関する次の記述のうち、正しいものはどれか。",

  options: [
    "選択肢1",
    "選択肢2",
    "選択肢3",
    "選択肢4"
  ],

  correct: 0,
  explanation: "解説文をここに書く。",

  difficulty: "basic",
  source: "AI-generated draft",
  verified: false,
  confidence: "unchecked",
  generatedBy: "Gemini",
  lawUpdatedAt: "2026-05-24"
}
```

---

## 5. 各フィールドの意味

| field | 意味 |
|---|---|
| id | 問題の永続ID。絶対に重複・再利用しない |
| category | 大分類。権利関係、宅建業法、法令上の制限、税・その他 |
| topic | 論点。例：免許制度、媒介契約、37条書面など |
| tags | 重複管理・検索・将来の絞り込み用タグ |
| question | 問題文 |
| options | 4択の選択肢 |
| correct | 正解のインデックス。0 / 1 / 2 / 3 |
| explanation | 解説文 |
| difficulty | basic / standard / advanced |
| source | 出典。AI生成時は AI-generated draft |
| verified | 公式確認済みかどうか |
| confidence | checked / unchecked など |
| generatedBy | 生成担当AI名 |
| lawUpdatedAt | 法令確認日または生成時点の日付 |

---

## 6. verified / source / confidence ルール

AI生成段階では必ず以下にする。

```js
source: "AI-generated draft",
verified: false,
confidence: "unchecked"
```

公式確認が済んだ問題のみ、将来的に以下のように変更できる。

```js
source: "RETIO / e-Gov / 国土交通省資料 / 公式過去問など",
verified: true,
confidence: "checked"
```

---

## 7. correct 分散ルール

4択問題の正解位置は、`0 / 1 / 2 / 3` に分散させる。

25問生成時の目安：

```txt
correct: 0 → 6問
correct: 1 → 6問
correct: 2 → 6問
correct: 3 → 7問
```

正解位置だけを機械的に動かして、問題文や選択肢が不自然にならないように注意する。

---

## 8. 重複防止ルール

重複管理は以下の3つで行う。

```txt
category
topic
tags
```

同じ topic でも、問う角度が違えば追加してよい。

例：

```txt
免許制度：大臣免許と知事免許
免許制度：免許の有効期間
免許制度：免許換え
免許制度：廃業等の届出
```

完全に同じ論点・同じひっかけ・同じ正解根拠の問題は避ける。

---

## 9. difficulty ルール

```txt
basic    = 初学者向け。条文・基本知識
standard = 本試験標準レベル。ひっかけあり
advanced = 細かい比較・例外・複合論点
```

Phase 1 の100問では、以下を目安にする。

```txt
basic: 50問
standard: 40問
advanced: 10問
```

---

## 10. Phase 1 追加計画

まずは100問まで増やす。

```txt
Set 1：TK-2026-0001〜0025
宅建業法 25問

Set 2：TK-2026-0026〜0050
権利関係 25問

Set 3：TK-2026-0051〜0075
法令上の制限 25問

Set 4：TK-2026-0076〜0100
宅建業法10問 + 税その他10問 + 弱点補強5問
```

---

## 11. Gemini 作問プロンプト雛形

```txt
宅建学習用Webアプリ「Takken Learning Hub」に追加する4択問題を25問作成してください。

目的：
宅建試験対策用の学習アプリに使う問題データを作る。

出力形式：
JavaScriptの配列形式で出力してください。
各問題は以下の形式にしてください。

{
  id: "TK-2026-0001",
  category: "",
  topic: "",
  tags: [],
  question: "",
  options: ["", "", "", ""],
  correct: 0,
  explanation: "",
  difficulty: "basic",
  source: "AI-generated draft",
  verified: false,
  confidence: "unchecked",
  generatedBy: "Gemini",
  lawUpdatedAt: "2026-05-24"
}

今回のID範囲：
TK-2026-0001 〜 TK-2026-0025

対象分野：
宅建業法

優先テーマ：
・免許制度
・宅地建物取引士
・営業保証金
・保証協会
・媒介契約
・重要事項説明
・37条書面
・報酬制限
・広告規制
・業務上の規制

ルール：
・idは絶対に重複させない
・correctは0/1/2/3にできるだけ分散させる
・AI生成問題なので verified は必ず false
・source は必ず "AI-generated draft"
・confidence は必ず "unchecked"
・generatedBy は "Gemini"
・解説は初学者にも分かるように簡潔に書く
・明らかに法改正リスクがある断定は避ける
・過去問の丸写しは禁止
・選択肢は4つ
・正解は1つだけ
・問題文と選択肢に矛盾がないようにする
・topicとtagsで内容が重複しすぎないようにする

注意：
この段階の問題は未検証の下書きです。
RETIO、e-Gov、国土交通省資料、公式過去問等で確認する前提です。
```

---

## 12. Codex 構造レビュー用プロンプト雛形

```txt
以下は宅建学習用Webアプリ「Takken Learning Hub」に追加予定の問題データです。

レビューしてください。

確認してほしい項目：
1. idの重複がないか
2. id形式が TK-2026-0001 の形式になっているか
3. optionsが必ず4つあるか
4. correctが0/1/2/3の範囲内か
5. correctの分布が偏りすぎていないか
6. question、options、explanationに空欄がないか
7. verified:false になっているか
8. source:"AI-generated draft" になっているか
9. confidence:"unchecked" になっているか
10. generatedBy が入っているか
11. topicとtagsが重複管理に使える内容になっているか
12. JavaScript構文として問題ないか
13. 既存questions.jsに追加した時に壊れないか

注意：
法律内容の最終確認ではなく、構造・形式・重複・実装面のレビューを優先してください。
法律内容に怪しい点があれば「要ファクトチェック」として指摘してください。

以下が問題データです。
```

---

## 13. Claude Code 反映用プロンプト雛形

```txt
Takken Learning Hub の questions.js に、以下の25問を追加してください。

作業ルール：
・既存の問題データは削除しない
・既存のidは変更しない
・新規問題は末尾に追加する
・JavaScript構文が壊れないようにする
・配列のカンマ抜けに注意する
・追加後、構文エラーがないか確認する
・アプリの既存機能を変更しない
・作問内容は変更しない
・明らかな構文ミスだけ修正する

追加する問題：
ここに25問のデータを貼る
```

---

## 14. 運用上の注意

Claude Code は作問ではなく、反映・実装・UI修正・GitHub反映に使う。

Gemini は大量生成、Codex は構造レビュー、シンクは設計・判断・整形、Grok は競合調査・市場調査・販売戦略に使う。

問題追加前には必ずこの規格を確認する。
