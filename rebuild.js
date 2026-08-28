// 使い方: このフォルダで  node rebuild.js  を実行すると、
//   data/jobs.json  → template.html        → index.html
//   data/jobs.json  → apply-template.html  → apply.html   （求人の見出しだけを差し込む）
// を再生成します。
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
function newGradOnly(jobs){
  const kept = jobs.filter(j => KEEP.includes(j.kubun));
  const dropped = jobs.length - kept.length;
  if(dropped > 0){
    const by = {};
    jobs.forEach(j => { if(!KEEP.includes(j.kubun)) by[j.kubun || '区分なし'] = (by[j.kubun || '区分なし']||0)+1; });
    const detail = Object.entries(by).map(([k,v]) => `${k} ${v}件`).join(' / ');
    console.log(`新卒・インターン以外を除外しました: ${dropped}件（${detail}）`);
  }
  return kept;
}

const jobs = build('jobs.json', 'template.html', 'index.html', '__JOBS_DATA__', [], newGradOnly);
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
