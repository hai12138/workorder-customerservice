import fs from 'fs';

function extractStrings(file, patterns) {
  const t = fs.readFileSync(file, 'utf8');
  const out = {};
  for (const [name, re] of Object.entries(patterns)) {
    const set = new Set();
    let m;
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    while ((m = r.exec(t))) set.add(m[0]);
    out[name] = [...set];
  }
  // also pull quoted chinese labels
  const labels = new Set();
  const lr = /["']([\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9_（）()\-\/]{1,20})["']/g;
  let m;
  while ((m = lr.exec(t))) labels.add(m[1]);
  out.labels = [...labels].slice(0, 200);
  // APIs
  const apis = new Set();
  const ar = /["'`](\/(?:order|jsonflow|property|admin)[^"'`]{0,100})["'`]/g;
  while ((m = ar.exec(t))) apis.add(m[1]);
  out.apis = [...apis];
  return out;
}

const files = [
  'D:/project/workorder-customerservice/probe/assets_flow-application.DhthQ5MF.js',
  'D:/project/workorder-customerservice/probe/assets_handover-flow.CYDna6T8.js',
  'D:/project/workorder-customerservice/probe/assets_run-flow.Bjvf-W0x.js',
  'D:/project/workorder-customerservice/probe/assets_def-flow.DklIuMIO.js',
  'D:/project/workorder-customerservice/probe/assets_flow-rule.DDz38S1W.js',
];

for (const f of files) {
  console.log('\n########', f.split('/').pop());
  const r = extractStrings(f, {});
  console.log('APIs:', r.apis.join('\n'));
  console.log('Labels sample:', r.labels.slice(0, 80).join(' | '));
}
