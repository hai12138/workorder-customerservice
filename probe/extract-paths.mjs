import fs from 'fs';
const text = fs.readFileSync('D:/project/workorder-customerservice/probe/index.BybHHtWj.js', 'utf8');
const paths = new Set();
const re = /["'`](\/[A-Za-z0-9_\-./{}]+)["'`]/g;
let m;
while ((m = re.exec(text))) {
  const p = m[1];
  if (/property|workorder|ticket|dispatch|sla|service-type|customer-service|open-app|notif|exception|plan|field|flow/i.test(p)) {
    paths.add(p);
  }
}
const re2 = /assets\/[A-Za-z0-9_\-.]+\.js/g;
const assets = new Set();
while ((m = re2.exec(text))) assets.add(m[0]);
console.log('PATHS');
console.log([...paths].sort().join('\n'));
console.log('\nASSETS', assets.size);
const propAssets = [...assets].filter(a => /property|workorder|customer|dispatch|sla|flow|plan|notif|exception|config|service/i.test(a));
console.log(propAssets.join('\n'));

// also find chinese labels near property
const labels = ['项目管理','空间管理','用户与员工','角色权限','配置总览','工单类型','表单字段','派单规则','通知模板','计划工单','工单台账','异常列表','开放应用','运营总览','上线检查','移动端身份','消息中心','配置版本'];
for (const k of labels) {
  console.log(k, text.includes(k) ? 'YES' : 'NO');
}
