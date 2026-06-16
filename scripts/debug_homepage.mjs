import puppeteer from 'puppeteer';
const W = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox']
  });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await W(4000);
  // Login
  const u = await p.$('input[placeholder*="用户"]');
  if (u) { await u.focus(); await W(200); await p.keyboard.type('admin', { delay: 50 }); }
  await W(300);
  const pw = await p.$('input[placeholder*="····"], input[type="password"]');
  if (pw) { await pw.focus(); await W(200); await p.keyboard.type('admin123', { delay: 50 }); }
  await W(500);
  await p.evaluate(() => { document.querySelectorAll('button').forEach(b => { if (b.type === 'submit') b.click(); }); });
  await W(8000);
  // Dump button texts
  const texts = await p.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .map(b => ({ tag: b.tagName, txt: (b.textContent || '').trim().slice(0, 100), cls: (b.className || '').slice(0, 40) }));
  });
  console.log('Buttons on homepage:');
  texts.forEach((t, i) => console.log(`  [${i}] ${JSON.stringify(t.txt)} | ${t.cls}`));
  // Also check if "前期工作" appears anywhere
  const found = await p.evaluate(() => {
    return document.body.textContent.includes('前期工作');
  });
  console.log('\nPage contains "前期工作":', found);
  await b.close();
})();
