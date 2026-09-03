import fs from 'fs';
import https from 'https';
import http from 'http';

const text = fs.readFileSync('D:/project/workorder-customerservice/probe/index.BybHHtWj.js', 'utf8');

function find(substr, ctx = 120) {
  const out = [];
  let i = 0;
  while ((i = text.indexOf(substr, i)) !== -1 && out.length < 20) {
    out.push(text.slice(Math.max(0, i - ctx), i + substr.length + ctx).replace(/\n/g, ' '));
    i += substr.length;
  }
  return out;
}

const needles = [
  'PropertyProject',
  'PropertySpace',
  'PropertyUser',
  'PropertyRole',
  'config-overview',
  'service-types',
  'service-fields',
  'dispatch-rules',
  'notification-rules',
  'open-applications',
  'operations-overview',
  'workorders',
  'flow-sla',
  '/api/',
  'admin-api',
  'property/',
];

for (const n of needles) {
  const hits = find(n, 100);
  console.log('\n====', n, 'hits', hits.length);
  hits.slice(0, 3).forEach((h, idx) => console.log(idx, h));
}

// extract all /api/... strings
const apis = new Set();
const re = /["'`](\/api\/[^"'`]+)["'`]/g;
let m;
while ((m = re.exec(text))) apis.add(m[1]);
fs.writeFileSync('D:/project/workorder-customerservice/probe/apis-from-index.json', JSON.stringify([...apis].sort(), null, 2));
console.log('\nAPI count', apis.size);
