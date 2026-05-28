# PHASE7F まとめレポート

作成日：2026-05-28  
Phase 7-F 完了時点のまとめ

---

## 1. Phase 7-F の目的

「品質継続改善（Quality Continuous Improvement）」  
Phase 7-E（チャプター構造整備）完了後、300問の教材品質を系統的に引き上げることを目的とした。

主な目標：
- 解説不足・表現不明瞭な問題の説明文を改善
- 類似問題の重複を整理し、各問の出題価値を高める
- 誤記・起算点の矛盾など品質上の問題を修正
- Geminiレビューを活用した外部視点からの品質確認

---

## 2. Step 1〜Step 12 の作業概要

| Step | 内容 | 成果物 |
|------|------|--------|
| Step 1 | Codex集計レポート作成（300問監査・解説長さ・類似問題候補） | PHASE7F_CODEX_AUDIT_REQUEST.md |
| Step 2 | Gemini教材品質レビュー依頼資料作成 | PHASE7F_GEMINI_REVIEW_REQUEST.md |
| Step 3 | Geminiレビュー採用判断レポート作成 | PHASE7F_GEMINI_REVIEW_DECISION.md |
| Step 4 | A優先3問の解説拡充（TK-0001・TK-0038・TK-0083） | questions-takken.js / rights.js / tax.js 修正 |
| Step 5 | TK-2026-0145の選択肢②修正・解説全面改訂（クーリング・オフ起算点） | questions-takken.js 修正 |
| Step 6 | 修正・確認済み7問に verified=true / confidence="high" 付与 | questions-takken.js / rights.js / tax.js 修正 |
| Step 7 | 類似問題11件の精査レポート作成（A/B/C分類） | PHASE7F_SIMILAR_QUESTIONS_DECISION.md |
| Step 8 | B判定4件の explanation 修正（解説修正のみ） | questions-takken.js / laws.js / tax.js 修正 |
| Step 9 | C判定3件の修正方針レポート作成 | PHASE7F_C_RANKED_REVISION_PLAN.md |
| Step 10 | C判定：TK-2026-0022 options[1] 修正（手付保全措置） | questions-takken.js 修正 |
| Step 11 | C判定：TK-2026-0122 options[1][2] 修正（保証付従性・絶対効） | questions-rights.js 修正 |
| Step 12 | C判定：TK-2026-0052 全面再設計（市街化調整区域の定義） | questions-laws.js 修正 |

---

## 3. 作成したレポート一覧

| ファイル名 | 内容 | コミット |
|-----------|------|---------|
| PHASE7F_QUALITY_IMPROVEMENT_PLAN.md | Phase 7-F 詳細計画 | 78d7fc1 |
| PHASE7F_CODEX_AUDIT_REQUEST.md | 300問監査・類似候補抽出 | 6fbc8e7 |
| PHASE7F_GEMINI_REVIEW_REQUEST.md | Geminiレビュー依頼資料 | ee28526 |
| PHASE7F_GEMINI_REVIEW_DECISION.md | Geminiレビュー採用判断 | de36e29 |
| PHASE7F_SIMILAR_QUESTIONS_DECISION.md | 類似問題11件 A/B/C分類 | 3209fe5 |
| PHASE7F_C_RANKED_REVISION_PLAN.md | C判定3件 修正方針 | b8c91e4 |
| PHASE7F_SUMMARY.md | Phase 7-F まとめ（本ファイル） | — |

---

## 4. 実装修正した問題ID一覧

| ID | ファイル | 修正内容 |
|----|---------|---------|
| TK-2026-0001 | questions-takken.js | explanation 拡充（復権・法人の役員欠格） |
| TK-2026-0038 | questions-rights.js | explanation 拡充（2020年民法改正・危険負担） |
| TK-2026-0083 | questions-tax.js | explanation 修正（「※制度変更に注意」削除・相続時精算課税補足追加） |
| TK-2026-0145 | questions-takken.js | options[2] 修正（翌日起算→初日算入の差別化）・explanation 全面改訂 |
| TK-2026-0020 | questions-takken.js | explanation 修正（廃業後継続・裁判証言論点の明確化） |
| TK-2026-0111 | questions-takken.js | explanation 修正（有効期限なし・返納義務の補足追加） |
| TK-2026-0057 | questions-laws.js | explanation 修正（セットバック補足追加） |
| TK-2026-0077 | questions-tax.js | explanation 修正（税率1.4%・使用者課税例外補足追加） |
| TK-2026-0022 | questions-takken.js | options[1] 修正（超過部分無効→手付保全措置に差し替え）・explanation 改訂 |
| TK-2026-0122 | questions-rights.js | options[1][2] 修正（催告の抗弁権→付従性・絶対効に差し替え）・explanation 改訂 |
| TK-2026-0052 | questions-laws.js | question・options[0〜3]・explanation・topic・tags 全面再設計（市街化調整区域の定義） |

**計11問修正**

---

## 5. verified=true / confidence="high" を付与した問題ID一覧

Step 6 にて以下7問に付与（コミット 292ca4b）。

| ID | ファイル | 付与理由 |
|----|---------|---------|
| TK-2026-0001 | questions-takken.js | Step 4 解説拡充・内容確認済み |
| TK-2026-0023 | questions-takken.js | 内容確認済み（Step 6 対象） |
| TK-2026-0038 | questions-rights.js | Step 4 解説拡充・民法改正内容確認済み |
| TK-2026-0082 | questions-tax.js | 内容確認済み（Step 6 対象） |
| TK-2026-0083 | questions-tax.js | Step 4 解説修正・内容確認済み |
| TK-2026-0095 | questions-tax.js | 内容確認済み（Step 6 対象） |
| TK-2026-0145 | questions-takken.js | Step 5 選択肢・解説修正・内容確認済み |

---

## 6. B判定4件の explanation 修正内容

| ID | 論点 | 修正のポイント |
|----|------|--------------|
| **TK-2026-0020** | 守秘義務（宅建業法） | 「裁判証言は正当な理由に該当」の説明に加え、「廃業後・退職後も継続」という論点を明示。類似問題TK-0198（廃業後継続）との差別化を説明文で補強 |
| **TK-2026-0111** | 従業者証明書（宅建業法） | 「全従業者対象・資格不問」の説明に加え、「有効期限の定めなし・従業者でなくなれば返納」を補足。類似問題TK-0273（有効期限なし）との差別化 |
| **TK-2026-0057** | 接道義務（建築基準法） | 「2m以上の接道義務」の説明に加え、「幅員4m未満の2項道路にはセットバックが必要」を末尾に追記。類似問題TK-0170（セットバック追加）との差別化 |
| **TK-2026-0077** | 固定資産税（税・その他） | 「1月1日賦課期日・日割りなし」の説明に加え、「標準税率1.4%・質権者・地上権者への使用者課税例外」を補足。類似問題TK-0289（税率・使用者課税）との差別化 |

---

## 7. C判定3件の修正内容

### TK-2026-0022（questions-takken.js）

- **変更前**：options[1]「代金の20%を超える手付金を定めた場合、定め全体が無効」  
  → 類似問題TK-0195と同一論点（超過部分のみ無効）
- **変更後**：options[1]「未完成・完成物件を問わず、必ず保全措置が必要」（誤り）  
  → 「手付金等保全措置の要件（完成10%以下・未完成5%以下かつ1,000万円以下なら不要）」に論点差し替え
- correct: 1 変更なし

### TK-2026-0122（questions-rights.js）

- **変更前**：options[1]「連帯保証人には催告の抗弁権がある」・options[2]「保証人に催告あり・連帯保証人になし」  
  → 類似問題TK-0167と正解の核心が同一（連帯保証人に抗弁権なし）
- **変更後**：options[1]「連帯保証人には催告の抗弁権および検索の抗弁権が認められる」（誤り）・options[2]「保証債務は付従するため主債務消滅で保証債務も消滅」（正しい）  
  → 「保証の付従性（民法448条）」に正解の論点を差し替え
- correct: 2 変更なし

### TK-2026-0052（questions-laws.js）

- **変更前**：question「区域区分に関する…」・options[3]「市街化**区域**の定義（すでに形成＋10年以内）」  
  → 類似問題TK-0123と正解選択肢が一字一句ほぼ同一
- **変更後**：question「区域区分に関する…」（短縮）・options[3]「市街化**調整**区域は市街化を抑制すべき区域」（正しい）  
  → TK-0052：調整区域の定義 / TK-0123：市街化区域の定義 で差別化
- topic: 「区域区分」→「市街化調整区域の定義」・tags も更新
- correct: 3 変更なし

---

## 8. 変更しなかったもの

| 対象 | 理由 |
|------|------|
| `script.js` | Phase 7-F の範囲外。問題データの品質改善のみ |
| `style.css` | Phase 7-F の範囲外 |
| `index.html` | Phase 7-F の範囲外 |
| 総問題数（300問） | 全フェーズを通じて維持 |
| カテゴリ数・各75問 | 全フェーズを通じて維持 |
| A判定4件（TK-0148・TK-0156・TK-0116・TK-0183） | 削除には代替問題が必要なため保留（PHASE7F_SIMILAR_QUESTIONS_DECISION.md に記録） |

---

## 9. verify-questions.ps1 の最終結果

| 項目 | 結果 |
|------|------|
| エラー数 | **0件** |
| 警告数 | **0件** |
| 総問題数 | **300問** |
| 宅建業法 | 75問 |
| 権利関係 | 75問 |
| 法令上の制限 | 75問 |
| 税・その他 | 75問 |
| ID重複 | なし |

---

## 10. GitHubに保存済みの主要コミット一覧

| コミットハッシュ | メッセージ |
|----------------|-----------|
| `78d7fc1` | Add Phase 7-F quality improvement plan |
| `6fbc8e7` | Add Phase 7-F Codex audit report |
| `ee28526` | Add Phase 7-F Gemini review request |
| `de36e29` | Add Phase 7-F Gemini review decision report |
| `203facb` | Improve explanations for Gemini high priority items |
| `8c0e7a0` | Fix TK-2026-0145: correct options and explanation |
| `292ca4b` | Mark reviewed high priority questions as verified |
| `3209fe5` | Add Phase 7-F similar questions decision report |
| `51bda49` | Improve explanations for similar B-ranked questions |
| `b8c91e4` | Add Phase 7-F C-ranked revision plan |
| `c4d7416` | Revise TK-2026-0022 hand money protection option |
| `ac63bbb` | Revise TK-2026-0122 suretyship options |
| `ee05587` | Revise TK-2026-0052 urbanization control area question |

---

## 11. Phase 7-F 完了時点の到達点

- **300問の品質レビューを系統的に完了**（Codex監査→Geminiレビュー→採用判断の3段階フロー確立）
- **11問を実装修正**：解説拡充4問・選択肢修正3問・解説修正4問
- **7問に verified=true / confidence="high" 付与**
- **類似問題11件を A/B/C 分類**し、B判定4件は解説修正・C判定3件は問題文差し替えで解消
- **A判定4件（削除候補）は代替問題準備まで保留**（次フェーズで対処）
- **verify-questions.ps1 エラー0・警告0** を全工程で維持
- **300問・4カテゴリ各75問** を全工程で維持

---

## 12. 次フェーズ候補

| 候補 | 内容 | 優先度 |
|------|------|--------|
| **Phase 8：500問化** | 各カテゴリ25問追加（75問→100問×4）、問題範囲の拡充 | 高 |
| **A判定4件の代替問題準備** | TK-0148・TK-0156・TK-0116・TK-0183 の削除・差し替え（代替問題作成が前提） | 中 |
| **unverified問題のレビュー** | verified=falseの問題（Phase 6・7で未検証のもの）の順次確認 | 中 |
| **模擬試験機能** | 本番形式（50問・時間制限）のモード追加 | 低 |

---

*Phase 7-F 完了。questions-*.jsへの変更はすべてTHINK確認後に実施。自動コミット・自動pushなし。*
