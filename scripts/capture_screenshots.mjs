import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
const OUT = 'docs/v1.7.0/screenshots';
mkdirSync(OUT, { recursive: true });
const W = ms => new Promise(r => setTimeout(r, ms));

let seq = 0;
function snap(page, label) {
  const n = String(++seq).padStart(2, '0') + '-' + label + '.png';
  return page.screenshot({ path: `${OUT}/${n}` }).then(() => console.log(`  ✅ ${n}`));
}

async function doLogin(page) {
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await W(2000);
  await page.evaluate(async () => {
    const r = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const d = await r.json();
    if (d.token) {
      localStorage.setItem('doc-system-token', d.token);
      localStorage.setItem('doc-system-auth', JSON.stringify(d));
    }
  });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await W(5000);
  // Wait for projects to render
  try { await page.waitForSelector('h3', { timeout: 10000 }); } catch {}
  await W(2000);
}

async function clickBtn(page, text, wait = 6000) {
  const r = await page.evaluate(t => {
    for (const el of document.querySelectorAll('button')) {
      if ((el.textContent || '').includes(t)) { const rc = el.getBoundingClientRect(); if (rc.width > 5 && rc.height > 5) return { x: rc.x + rc.width / 2, y: rc.y + rc.height / 2 }; }
    }
    return null;
  }, text);
  if (r) { console.log(`  🖱 ${text}`); await page.mouse.click(r.x, r.y); await W(wait); return true; }
  console.log(`  ❌ ${text}`); return false;
}

async function clickH3(page, index = 0) {
  const r = await page.evaluate(idx => {
    const hs = document.querySelectorAll('h3');
    if (hs.length <= idx) return null;
    const rc = hs[idx].getBoundingClientRect();
    return { x: rc.x + rc.width / 2, y: rc.y + rc.height / 2 };
  }, index);
  if (r) { console.log(`  🖱 project[${index}]`); await page.mouse.click(r.x, r.y); await W(7000); return true; }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // === 01: Login page ===
  console.log('📷 01-login');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await W(5000);
  await snap(page, '01-login');

  // === LOGIN ===
  console.log('🔐 登录...');
  await doLogin(page);

  // === 02: Project entry ===
  console.log('📷 02-project-entry');
  await snap(page, '02-project-entry');

  // === 03: Enter project → homepage ===
  console.log('📷 03-homepage');
  await clickH3(page, 0); // Click first project
  await snap(page, '03-homepage');

  // === 04: Guide modules ===
  console.log('📷 04-guide-modules');
  await clickBtn(page, '前期工作', 7000);
  await snap(page, '04-guide-modules');

  // === 05: Logic tab ===
  console.log('📷 05-guide-logic');
  await clickBtn(page, '时序逻辑图');
  await snap(page, '05-guide-logic');

  // === 06: Forms tab ===
  console.log('📷 06-guide-forms');
  await clickBtn(page, '附表清单');
  await snap(page, '06-guide-forms');

  // === 07: Dashboard ===
  console.log('📷 07-dashboard');
  // Fresh login + enter project
  await doLogin(page);
  await clickH3(page, 0);
  await W(3000);
  // Dump buttons for debugging
  const btns1 = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()?.slice(0,30)).filter(t => t && t.length < 25));
  console.log('  buttons:', JSON.stringify(btns1));
  // Find dashboard entry
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => {
      if (b.textContent?.includes('仪表') || b.textContent?.includes('盘') || b.textContent?.includes('Dashboard')) b.click();
    });
  });
  await W(7000);
  await snap(page, '07-dashboard');

  // === 08: Project edit ===
  console.log('📷 08-project-edit');
  await clickBtn(page, '返回', 5000);
  await W(3000);
  const h3 = await page.$('h3');
  if (h3) { const b = await h3.boundingBox(); if (b) { await page.mouse.move(b.x + b.width/2, b.y + b.height/2); await W(1000); await page.mouse.move(b.x + b.width - 40, b.y + b.height - 20); await W(2500); } }
  const eb = await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) { if ((b.getAttribute('title') || '').includes('编辑项目')) { const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; } }
    return null;
  });
  if (eb) { console.log('  🖱 edit'); await page.mouse.click(eb.x, eb.y); await W(5000); }
  await snap(page, '08-project-edit');

  // === 09: AI Chat ===
  console.log('📷 09-ai-chat');
  await doLogin(page);
  await W(2000);
  // Find and click AI button
  const btns2 = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()?.slice(0,20)).filter(t => t));
  console.log('  buttons:', JSON.stringify(btns2));
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => {
      const t = b.textContent?.trim() || '';
      if (t === 'AI' || t.includes('AI助手') || t.includes('智能助手')) b.click();
    });
  });
  await W(5000);
  await snap(page, '09-ai-chat');

  await browser.close();
  console.log('\n✅ 完成！');
})();
