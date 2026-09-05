# 学生向けプロフィール項目の Supabase 設定（2026-09-05）

新卒サイトのマイページで、大学・学部・出身地・現住所・希望業界・希望する働き方・希望する企業規模を
任意で登録できるようにした。`profiles` は中途サイト（jobsite）と**同じテーブル**なので、列を足すだけでよい。

## SQL（Supabase → SQL Editor で実行）

> **2026-09-05 実行済み**（本番 `jobsite-tokyo`）。REST で `select=university,...` が 42703 ではなく `[]` を返すことを確認。
> 列を足し直す必要が出たときだけ再実行する（`if not exists` なので二重実行しても無害）。

```sql
-- 学生向けプロフィール項目（すべて任意）。既存の列・RLS はそのまま。
alter table public.profiles add column if not exists university            text;    -- 大学（自由入力）
alter table public.profiles add column if not exists faculty               text;    -- 学部（系統）
alter table public.profiles add column if not exists hometown              text;    -- 出身地（都道府県／海外）
alter table public.profiles add column if not exists residence             text;    -- 現住所（都道府県／海外）
alter table public.profiles add column if not exists desired_industries    text[];  -- 希望業界（求人の「業界」の値）
alter table public.profiles add column if not exists work_styles           text[];  -- 希望する働き方
alter table public.profiles add column if not exists desired_company_sizes text[];  -- 希望する企業規模（大企業／メガベンチャー・ミドルベンチャー／中小・老舗／ベンチャー・スタートアップ）
```

RLS は行単位（「本人のプロフィールのみ」）なので、列を足しても追加の設定は不要。

## SQL 未実行のときの挙動

`template.html` の `hasStudentCols` が退避フラグ。読み込みで列が無いと分かると `false` になり、
- 学生向けの7項目は**保存対象から外す**（他の項目は保存できる）
- コンソールに「PROFILE_STUDENT_SETUP.md の SQL を実行してください」と出る

⚠ フラグが `false` の間に「プロフィールを保存」しても学生向け項目は保存されない。入力欄は出るので、
本番で SQL を流し忘れると「保存しました」と出るのに残らない状態になる。公開前に必ず実行する。

## 中途サイトとの関係

| 項目 | 中途 jobs | 新卒 shinsotsu |
|---|---|---|
| お名前・年齢・希望職種・希望勤務地・受信同意 | 両方で使う | 両方で使う |
| 現職の業種・経験職種・希望年収・転職時期 | 使う | **画面に出さない**（列はそのまま） |
| 大学・学部・出身地・現住所・希望業界・働き方・企業規模 | 画面に出さない | 使う |

同じ会員が両方のサイトを使うと、それぞれの画面に出ていない項目は**触らない**（`upsert` で送らない）ので消えない。

## 管理画面（jobsite\admin）への反映

スカウト管理画面の `profiles` の select にはまだこの7列を入れていない。新卒会員へスカウトするときに、
大学・希望業界で絞れるようにするなら `admin/index.html` の select と一覧の列を足す（backlog #20 と一緒にやる）。
