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
  await p.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await W(4000);

  const inputs = await p.$$('input');
  console.log('Found', inputs.length, 'inputs');
  for (const inp of inputs) {
    const ph = await p.evaluate(el => el.getAttribute('placeholder') || '', inp);
    const type = await p.evaluate(el => el.type, inp);
    console.log(`  ${ph} (type=${type})`);
  }

  // Type into inputs
  const uInp = await p.$('input[placeholder*="用户"]');
  if (uInp) {
    await uInp.focus();
    await W(200);
    await p.keyboard.type('admin', { delay: 80 });
    await W(300);
    // Trigger React change
    await uInp.evaluate(el => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, 'admin');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  const pInp = await p.$('input[placeholder*="····"], input[type="password"]');
  if (pInp) {
    await pInp.focus();
    await W(200);
    await p.keyboard.type('admin123', { delay: 80 });
    await W(300);
    await pInp.evaluate(el => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, 'admin123');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  await W(1000);

  // Check values
  const vals = await p.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({ ph: i.placeholder, val: i.value }));
  });
  console.log('Values:', JSON.stringify(vals));

  // Click submit
  const clicked = await p.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.type === 'submit') { b.click(); return true; }
    }
    return false;
  });
  console.log('Submit clicked:', clicked);
  await W(10000);

  const h1 = await p.evaluate(() => document.querySelector('h1')?.textContent);
  console.log('H1:', h1);
  const btns = await p.evaluate(() => Array.from(document.querySelectorAll('button')).slice(0, 8).map(b => b.textContent?.trim()));
  console.log('Buttons:', btns);

  await b.close();
})();
