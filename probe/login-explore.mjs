import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://os.nexfield.top/aiot/web';
const USER = 'staff_18713789724';
const PASS = 'Nexfieldos1';
const outDir = new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
});
const page = await context.newPage();

const apiLog = [];
page.on('response', async (res) => {
  const url = res.url();
  if (!/os\.nexfield\.top/.test(url)) return;
  if (/\.(js|css|png|jpg|svg|woff2?|ico|map)(\?|$)/i.test(url)) return;
  let body = '';
  try {
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json') || ct.includes('text')) {
      body = (await res.text()).slice(0, 8000);
    }
  } catch {}
  apiLog.push({
    status: res.status(),
    method: res.request().method(),
    url,
    bodyPreview: body,
  });
});

async function dump(name) {
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  const html = await page.content();
  fs.writeFileSync(`${outDir}/${name}.html`, html);
  const text = await page.evaluate(() => document.body?.innerText || '');
  fs.writeFileSync(`${outDir}/${name}.txt`, text);
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await dump('01-landing');

  // Try common login selectors
  const userSelectors = [
    'input[placeholder*="账号"]',
    'input[placeholder*="用户"]',
    'input[placeholder*="手机"]',
    'input[name="username"]',
    'input[type="text"]',
    'input[type="tel"]',
  ];
  const passSelectors = [
    'input[placeholder*="密码"]',
    'input[name="password"]',
    'input[type="password"]',
  ];

  let userEl = null;
  for (const s of userSelectors) {
    const el = page.locator(s).first();
    if (await el.count()) { userEl = el; break; }
  }
  let passEl = null;
  for (const s of passSelectors) {
    const el = page.locator(s).first();
    if (await el.count()) { passEl = el; break; }
  }

  if (!userEl || !passEl) {
    // maybe already redirected or login in iframe/dialog
    fs.writeFileSync(`${outDir}/debug-no-login.txt`, await page.content());
    throw new Error('Login inputs not found');
  }

  await userEl.fill(USER);
  await passEl.fill(PASS);

  const loginBtn = page.locator('button:has-text("登录"), button:has-text("登陆"), button[type="submit"]').first();
  await loginBtn.click();
  await page.waitForTimeout(4000);
  await page.waitForLoadState('networkidle').catch(() => {});
  await dump('02-after-login');

  // Collect sidebar/menu text
  const menu = await page.evaluate(() => {
    const picks = [];
    const nodes = document.querySelectorAll('.el-menu-item, .el-sub-menu__title, .n-menu-item, .ant-menu-item, [class*="menu"] a, aside a, nav a');
    nodes.forEach((n) => {
      const t = (n.innerText || n.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length < 80) picks.push(t);
    });
    return [...new Set(picks)];
  });
  fs.writeFileSync(`${outDir}/menu.json`, JSON.stringify(menu, null, 2));

  // Click through top-level menu items (limited)
  const clickable = page.locator('.el-menu-item, .el-sub-menu__title');
  const count = await clickable.count();
  const visited = [];
  for (let i = 0; i < Math.min(count, 40); i++) {
    const item = clickable.nth(i);
    const label = ((await item.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!label) continue;
    try {
      await item.click({ timeout: 2000 });
      await page.waitForTimeout(1200);
      visited.push({ label, url: page.url() });
      const safe = String(i).padStart(2, '0') + '-' + label.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 30);
      await dump(`menu-${safe}`);
    } catch (e) {
      visited.push({ label, error: String(e) });
    }
  }
  fs.writeFileSync(`${outDir}/visited.json`, JSON.stringify(visited, null, 2));
  fs.writeFileSync(`${outDir}/api-log.json`, JSON.stringify(apiLog, null, 2));

  console.log(JSON.stringify({ menuCount: menu.length, visited: visited.length, apis: apiLog.length, url: page.url() }, null, 2));
} catch (e) {
  console.error('ERROR', e);
  await dump('error');
  fs.writeFileSync(`${outDir}/api-log.json`, JSON.stringify(apiLog, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
