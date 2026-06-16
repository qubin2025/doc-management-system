import puppeteer from 'puppeteer';
const W = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await W(5000);

  // Use keyboard-based typing (reliable for React)
  const userInput = await p.$('input[placeholder*="用户名"], input[placeholder*="邮箱"]');
  if (userInput) {
    await userInput.focus();
    await W(300);
    await p.keyboard.type('admin', { delay: 50 });
  }
  await W(500);
  const pwdInput = await p.$('input[placeholder*="····"], input[type="password"]');
  if (pwdInput) {
    await pwdInput.focus();
    await W(300);
    await p.keyboard.type('admin123', { delay: 50 });
  }
  await W(1000);

  // Click submit by evaluating click directly
  await p.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.type === 'submit' && (b.textContent || '').includes('登')) {
        b.click();
        return;
      }
    }
  });
  await W(8000);

  const btns = await p.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .map(b => b.textContent?.trim()?.slice(0, 50))
      .filter(t => t?.length > 0);
  });
  console.log('After login buttons:', JSON.stringify(btns));

  const h1 = await p.evaluate(() => document.querySelector('h1')?.textContent || 'no h1');
  console.log('H1:', h1);

  await b.close();
})();
