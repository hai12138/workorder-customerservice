import fs from 'fs';
import path from 'path';

const dir = 'D:/project/workorder-customerservice/probe';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const apiRe = /["'`](\/(?:order|jsonflow|property|admin|api|infra|system)[^"'`]{0,120})["'`]/g;
const apis = new Set();
const chineseHits = [];
const interesting = [];

for (const f of files) {
  const t = fs.readFileSync(path.join(dir, f), 'utf8');
  let m;
  while ((m = apiRe.exec(t))) apis.add(m[1]);
  for (const k of ['工单', '派单', 'SLA', '表单字段', '服务类型', '空间', '项目', '异常', '通知', '流程', '班组', '班次']) {
    if (t.includes(k)) interesting.push([f, k]);
  }
}

fs.writeFileSync(path.join(dir, 'apis-all.json'), JSON.stringify([...apis].sort(), null, 2));
console.log('APIs', apis.size);
console.log([...apis].sort().join('\n'));
console.log('\nInteresting files:');
for (const [f, k] of interesting) console.log(f, k);

// find chunk imports referencing property pages from index
const index = fs.readFileSync(path.join(dir, 'index.BybHHtWj.js'), 'utf8');
const chunkRe = /assets\/[A-Za-z0-9_\-.]+\.js/g;
const chunks = new Set();
while ((m = chunkRe.exec(index))) chunks.add(m[0]);
fs.writeFileSync(path.join(dir, 'index-chunks.json'), JSON.stringify([...chunks].sort(), null, 2));
console.log('\nindex chunks', chunks.size);
