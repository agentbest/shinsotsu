// 使い方: このフォルダで  node rebuild.js  を実行すると、
//   data/jobs.json（＋ data/logos.json） → template.html        → index.html
//   data/jobs.json  → apply-template.html  → apply.html   （求人の見出しだけを差し込む）
//   data/1day.json  → 1day-template.html   → 1day.html
// を再生成します。data/1day.json は  node fetch-1day.js  で Airtable から取得します。
const fs = require('fs'), path = require('path');
const dir = __dirname;

// <script> 内に安全に埋め込めるようエスケープする
const SEP = new RegExp('[\\u2028\\u2029]', 'g');
function embed(data){
  return JSON.stringify(data)
    .replace(/<\//g, '<\\/')
    .replace(SEP, m => '\\u' + m.charCodeAt(0).toString(16));
}

function build(dataFile, tplFile, outFile, placeholder, fallback, transform){
  const dataPath = path.join(dir, 'data', dataFile);
  const tplPath  = path.join(dir, tplFile);
  if(!fs.existsSync(tplPath)){
    console.log(`${tplFile} が無いのでスキップしました。`);
    return null;
  }
  let data = fallback;
  if(fs.existsSync(dataPath)){
    data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }else{
    console.log(`data/${dataFile} が無いので空で生成します。`);
  }
  if(transform) data = transform(data);
  const tpl = fs.readFileSync(tplPath, 'utf8');
  const out = tpl.replace(placeholder, () => embed(data));
  fs.writeFileSync(path.join(dir, outFile), out, 'utf8');
  return data;
}

/* このサイトは新卒とインターンだけを載せる（中途は jobs.agent-best.net の担当）。
   Airtable 側に中途が混ざっていても、ここで必ず落としてから埋め込む。
   ⚠ この関数を外すと、中途求人が「新卒サイト」として公開される。 */
const KEEP = ['新卒', 'インターン'];

/* 掲載を終えた卒業年。**年度が変わったらここに足す**（例：27卒の募集が終わったら '27卒' を追加）。
   対象卒業年がこのリストの値「だけ」の求人を落とす。
   ⚠ 第二新卒・通年・未入力の求人は落とさない。中途サイトも 区分≠中途 で弾くので、
      ここから外すと どちらのサイトにも出ない求人ができてしまう。 */
const PAST_GRADS = ['26卒'];
function seasonOver(job){
  const g = job.gradYear;
  if(!Array.isArray(g) || !g.length) return false;   // 未入力は判断できないので残す
  return g.every(v => PAST_GRADS.includes(v));
}

function newGradOnly(jobs){
  /* ⚠ 区分が空の求人はこのサイトからは落ちるが、中途サイトには載る（あちらの既定が中途のため）。
     非対称なので、気づけるように名指しで警告する。 */
  const noKubun = jobs.filter(j => !j.kubun);
  if(noKubun.length){
    console.log(`⚠ 区分が空の求人が ${noKubun.length}件あります。このサイトには出ませんが、中途サイトには出ます:`);
    noKubun.slice(0, 10).forEach(j => console.log(`   - ${j.company || '企業名なし'} / ${j.position || j.title || j.id}`));
    if(noKubun.length > 10) console.log(`   …ほか ${noKubun.length - 10}件`);
  }
  const inScope = jobs.filter(j => KEEP.includes(j.kubun));

  /* 募集が終わった卒業年を落とす */
  const over = inScope.filter(seasonOver);
  if(over.length){
    console.log(`募集が終わった卒業年（${PAST_GRADS.join('・')}）を除外しました: ${over.length}件`);
    over.forEach(j => console.log(`   - ${j.company || '企業名なし'} / ${(j.position || j.title || j.id).slice(0, 40)}`));
  }
  const kept = inScope.filter(j => !seasonOver(j));
  const dropped = jobs.length - inScope.length;
  if(dropped > 0){
    const by = {};
    jobs.forEach(j => { if(!KEEP.includes(j.kubun)) by[j.kubun || '区分なし'] = (by[j.kubun || '区分なし']||0)+1; });
    const detail = Object.entries(by).map(([k,v]) => `${k} ${v}件`).join(' / ');
    console.log(`新卒・インターン以外を除外しました: ${dropped}件（${detail}）`);
  }
  return kept;
}

/* 企業ロゴ。Airtable「求人DB（企業）」の ロゴ 列から取り込んだ画像を、
   data/logos.json（企業名 → リポジトリ内のパス）経由で求人1件ずつに差し込む。
   ⚠ jobs 側（data/jobs.json）に書かないのは、jobs.json が Airtable から
     「取り直すたび丸ごと入れ替わるスナップショット」だから。書くと毎回消える。
   ⚠ Airtable の添付URLは数時間で失効するので、URLを直接持たせてはいけない。
     画像は assets/logos/ に置いて、そのパスを logos.json に書く（node fetch-logos.js）。
   ⚠ jobs.agent-best.net（jobsite）側に同じ関数がある。片方だけ直すと、
     同じ企業のロゴが片方のサイトにだけ出る。 */
function attachLogos(jobs){
  const logoPath = path.join(dir, 'data', 'logos.json');
  if(!fs.existsSync(logoPath)){
    console.log('data/logos.json が無いので、ロゴは頭文字タイルのままにします。');
    return jobs;
  }
  const logos = JSON.parse(fs.readFileSync(logoPath, 'utf8'));
  /* ⚠ ファイルが実在しないパスを埋め込むと、カードに壊れた画像が出る。
     頭文字タイルの方がまだきれいなので、無いものは名指しで警告して落とす。 */
  const usable = {};
  for(const [company, rel] of Object.entries(logos)){
    if(fs.existsSync(path.join(dir, rel))) usable[company] = rel;
    else console.log(`⚠ ロゴ画像が見つかりません（頭文字タイルにします）: ${company} → ${rel}`);
  }
  let hit = 0;
  const missing = new Set();
  jobs.forEach(j => {
    const rel = usable[j.company];
    if(rel){ j.logo = rel; hit++; }
    else if(j.company) missing.add(j.company);
  });
  console.log(`企業ロゴ: ${hit}件の求人に表示（${Object.keys(usable).length}社）`);
  if(missing.size){
    console.log(`ロゴ未登録の企業 ${missing.size}社（頭文字タイルで表示）:`);
    [...missing].forEach(c => console.log(`   - ${c}`));
  }
  return jobs;
}

/* 従業員数。Airtable「求人DB（企業）」の 従業員数 列を、data/employees.json（企業名 → 原文）
   経由で求人1件ずつに差し込む（node fetch-employees.js で取得）。
   ⚠ ロゴと同じで jobs.json 側には書かない。jobs.json は Airtable からの
     「取り直すたび丸ごと入れ替わるスナップショット」なので、書くと毎回消える。
   ⚠ 原文のまま渡す。人数として読んで規模の段に振り分けるのは template.html 側
     （empNum / EMP_BANDS）。段の切り方を変えるのに Airtable を取り直さずに済ませるため。
   企業名の完全一致で引く。Airtable 側で社名を変えたら employees.json も直すこと。 */
function attachEmployees(jobs){
  const empPath = path.join(dir, 'data', 'employees.json');
  if(!fs.existsSync(empPath)){
    console.log('data/employees.json が無いので、従業員数と「企業規模」の絞り込みは出しません。');
    return jobs;
  }
  const emp = JSON.parse(fs.readFileSync(empPath, 'utf8'));
  let hit = 0;
  const missing = new Set();
  jobs.forEach(j => {
    const v = emp[j.company];
    if(v){ j.employees = v; hit++; }
    else if(j.company) missing.add(j.company);
  });
  console.log(`従業員数: ${hit}件の求人に表示（${Object.keys(emp).length}社）`);
  if(missing.size){
    console.log(`従業員数が未登録の企業 ${missing.size}社（「企業規模」で絞ると出ません）:`);
    [...missing].forEach(c => console.log(`   - ${c}`));
  }
  return jobs;
}

const jobs = build('jobs.json', 'template.html', 'index.html', '__JOBS_DATA__', [],
  data => attachEmployees(attachLogos(newGradOnly(data))));
if(jobs){
  const by = {};
  jobs.forEach(j => { by[j.kubun] = (by[j.kubun]||0)+1; });
  const detail = Object.entries(by).map(([k,v]) => `${k} ${v}件`).join(' / ');
  console.log('index.html を再生成しました:', jobs.length, `件（${detail}）`);
}

/* 申し込みフォームは「どの求人から来たか」を見出しに出すだけなので、
   求人データ全部ではなく ID・企業名・職種名・年収だけを持たせる。 */
function fmtSalary(j){
  const mn = j.salaryMin, mx = j.salaryMax;
  if(mn != null && mx != null) return mn === mx ? `${mn}万円` : `${mn}〜${mx}万円`;
  if(mx != null) return `〜${mx}万円`;
  if(mn != null) return `${mn}万円〜`;
  return '';
}
if(jobs){
  const mini = jobs.map(j => ({
    id: j.id,
    company: j.company || '',
    name: j.position || j.jobCategory || j.title || '求人',
    salary: fmtSalary(j),
  }));
  const tplPath = path.join(dir, 'apply-template.html');
  if(fs.existsSync(tplPath)){
    const out = fs.readFileSync(tplPath, 'utf8').replace('__JOBS_MINI__', () => embed(mini));
    fs.writeFileSync(path.join(dir, 'apply.html'), out, 'utf8');
    console.log('apply.html を再生成しました:', mini.length, '件の求人見出しを内蔵');
  }else{
    console.log('apply-template.html が無いのでスキップしました。');
  }
}

/* 1day選考会。Airtableの1テーブルを jobs（中途）と共有しているので、
   このサイトは「区分＝新卒・インターン」の回だけを載せる。
   ⚠ jobsite 側には鏡写しの midCareerEvents() がある。片方だけ直すと、
      同じ回が両サイトに出る／どちらにも出ない状態になる。
   ⚠ 求人と違い、区分が空の回はこのサイトには出さない（空欄＝中途扱いのため）。
      新卒の回が出てこないときは、まず Airtable の「区分」を疑うこと。 */
function newGradOnly1day(events){
  const kept = events.filter(e => e.kubun === '新卒・インターン');
  const noKubun = events.filter(e => !e.kubun);
  if(noKubun.length){
    console.log(`⚠ 区分が空の1day選考会が ${noKubun.length}件あります。中途扱いでこのサイトには出ません。Airtableで区分を入れてください:`);
    noKubun.forEach(e => console.log(`   - ${e.date || '日付なし'} / ${e.title || e.id}`));
  }
  const dropped = events.length - kept.length;
  if(dropped > 0) console.log(`新卒・インターン以外の1day選考会を除外しました: ${dropped}件`);
  return kept;
}

const events = build('1day.json', '1day-template.html', '1day.html', '__EVENTS_DATA__', [], newGradOnly1day);
if(events) console.log('1day.html を再生成しました:', events.length, '件（新卒・インターンのみ）');

/* 1day選考会は専用ページをナビから外し、検索結果の1位のPR枠に一本化した。
   index.html にはPR枠に出すぶん（直近3件の日程・タイトル・参加企業）だけを渡す。
   ⚠ 1day.json を更新したら rebuild.js を回すこと。回さないと一覧のPR枠が古いままになる。 */
function onedayMini(list){
  const today = new Date().toISOString().slice(0, 10);
  return (list || [])
    .filter(e => e.status !== 'closed')
    .filter(e => !e._iso || e._iso >= today)
    .slice(0, 3)
    .map(e => ({
      date: e.date || '',
      title: e.title || '1day選考会',
      company: e.companyLabel || '',
    }));
}
{
  const indexPath = path.join(dir, 'index.html');
  if(fs.existsSync(indexPath)){
    const mini = onedayMini(events);
    const html = fs.readFileSync(indexPath, 'utf8').replace('__ONEDAY_MINI__', () => embed(mini));
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('検索結果1位のPR枠:', mini.length ? `次回 ${mini[0].date}（掲載 ${mini.length}件）` : '開催なし（案内を受け取る導線を表示）');
  }
}
