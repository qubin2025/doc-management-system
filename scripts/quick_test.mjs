import puppeteer from 'puppeteer';
const W = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox']
  });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });

  // Pre-login via API and store in localStorage
  await p.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await W(2000);
  await p.evaluate(async () => {
    try {
      const r = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });
      const d = await r.json();
      if (d.token) {
        localStorage.setItem('doc-system-token', d.token);
        localStorage.setItem('doc-system-auth', JSON.stringify(d));
        console.log('Pre-login OK');
      }
    } catch (e) { console.error('Pre-login failed:', e); }
  });
  await W(1000);
  // Reload — app should detect auth and go to project-entry
  await p.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await W(8000);

  // Poll for projects
  for (let i = 0; i < 10; i++) {
    const info = await p.evaluate(() => ({
      h3count: document.querySelectorAll('h3').length,
      h1: document.querySelector('h1')?.textContent,
      empty: document.body.textContent?.includes('暂无项目'),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()?.slice(0,30)).filter(t => t)
    }));
    console.log(`  ${(i+1)*3}s: h3=${info.h3count} h1=${info.h1} empty=${info.empty}`);
    if (info.h3count > 0) { console.log('  H3s:', await p.evaluate(() => Array.from(document.querySelectorAll('h3')).map(h => h.textContent?.trim()))); break; }
    await W(3000);
  }
  await b.close();
})();
