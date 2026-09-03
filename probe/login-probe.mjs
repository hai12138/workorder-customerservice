import { chromium } from 'playwright';
import fs from 'fs';

const outDir = 'D:/project/workorder-customerservice/out';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const apiLog = [];
page.on('response', async (res) => {
  const url = res.url();
  if (!/os\.nexfield\.top/.test(url)) return;
  if (/\.(js|css|png|jpg|svg|woff2?|ico|map)(\?|$)/i.test(url) && !/property|workorder|customer/i.test(url)) return;
  let body = '';
  try {
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json')) body = (await res.text()).slice(0, 5000);
  } catch {}
  apiLog.push({ status: res.status(), method: res.request().method(), url, bodyPreview: body });
});

await page.goto('https://os.nexfield.top/aiot/web/', { waitUntil: 'networkidle', timeout: 60000 });
await page.screenshot({ path: `${outDir}/01-landing.png`, fullPage: true });
const text = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(`${outDir}/01-landing.txt`, text);
const inputs = await page.evaluate(() => [...document.querySelectorAll('input,button')].map(el => ({
  tag: el.tagName,
  type: el.type,
  name: el.name,
  id: el.id,
  placeholder: el.placeholder,
  text: (el.innerText||'').trim().slice(0,40),
  class: el.className?.toString?.().slice(0,80)
})));
fs.writeFileSync(`${outDir}/01-inputs.json`, JSON.stringify(inputs, null, 2));

// fill whatever looks like login
const user = page.locator('input').filter({ hasNot: page.locator('[type=password]') }).first();
const pass = page.locator('input[type=password]').first();
await user.fill('staff_18713789724');
await pass.fill('Nexfieldos1');
await page.screenshot({ path: `${outDir}/02-filled.png`, fullPage: true });

// try click any visible primary button
const buttons = page.locator('button');
const n = await buttons.count();
const btnInfo = [];
for (let i=0;i<n;i++) {
  const b = buttons.nth(i);
  const t = ((await b.innerText().catch(()=>''))||'').trim();
  const vis = await b.isVisible().catch(()=>false);
  btnInfo.push({ i, t, vis });
  if (vis && (/登录|登陆|Sign|Login|提交/i.test(t) || t==='')) {
    try { await b.click({ timeout: 3000 }); break; } catch {}
  }
}
fs.writeFileSync(`${outDir}/02-buttons.json`, JSON.stringify(btnInfo, null, 2));
await page.waitForTimeout(5000);
await page.screenshot({ path: `${outDir}/03-after-click.png`, fullPage: true });
fs.writeFileSync(`${outDir}/03-after.txt`, await page.evaluate(() => document.body.innerText));
fs.writeFileSync(`${outDir}/api-log.json`, JSON.stringify(apiLog, null, 2));
console.log('done', page.url());
await browser.close();
