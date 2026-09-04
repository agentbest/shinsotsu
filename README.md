# 新卒・インターン求人検索（shinsotsu.agent-best.net）

株式会社エージェントベストが運営する、**新卒・インターン向けの求人検索サイト**です。
中途（転職）は [jobs.agent-best.net](https://jobs.agent-best.net/) が担当しています。

## 更新のしかた

```bash
# 1. 求人データを差し替える（Airtable からのエクスポート）
#    data/jobs.json  ※中途が混ざっていても rebuild が落とすのでそのままでよい

# 2. 再生成
node rebuild.js

# 3. 確認（file:// では求人詳細の遷移が動かないので必ずHTTPで）
python -m http.server 8000

# 4. commit & push すると数十秒で反映される
```

`index.html` と `apply.html` は生成物です。**直接編集しないでください。**
編集するのは `template.html` / `apply-template.html` / `data/jobs.json` です。

## ファイル

| ファイル | 中身 |
|---|---|
| `template.html` | 求人検索ページのテンプレート（CSS・JSはインライン。外部CDNは読み込まない） |
| `apply-template.html` | 就活サポート申し込みフォームのテンプレート |
| `data/jobs.json` | Airtable から取り出した求人データ（新卒・インターンだけを使う） |
| `data/logos.json` | 企業ロゴの対応表（企業名 → `assets/logos/…` のパス） |
| `rebuild.js` | テンプレート＋データ → `index.html` / `apply.html` |
| `fetch-logos.js` | Airtable「求人DB（企業）」のロゴ列から画像を取り込み直す |
| `data/employees.json` | 従業員数の対応表（企業名 → Airtableの原文） |
| `fetch-employees.js` | Airtable「求人DB（企業）」の従業員数列を取り込み直す |
| `assets/` | ヒーロー画像・OGP画像・`logos/`（企業ロゴ） |
| `privacy.html` / `privacy-ad.html` / `terms.html` | プライバシーポリシー2種と利用規約 |

## 設計の要点・注意点

開発上の判断と踏んではいけない地雷は **`CLAUDE.md`** にまとめてあります。
特に次の3つは先に読んでください。

1. `rebuild.js` の `newGradOnly()` が「新卒サイトに中途を出さない」唯一の担保
2. 対象卒業年は Airtable の「対象卒業年」列（`gradYear`）が最優先。空の求人だけ求人名から推測する
3. Supabase は中途サイトと共有。**集計は `source` で分ける**（`grad_year` 列は追加済み）
