import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = process.argv[2] || 'http://localhost:3100';
const browser = await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined),headless:true});
try {
 for (const ticker of ['YB','AAPL']) {
  const url = `${origin}/stock/${ticker}/analisis`;
  const response = await fetch(url);
  assert.equal(response.status,200);
  // Scripts are removed so neither serialized props nor RSC payload count as readable HTML.
  const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  const context = await browser.newContext({javaScriptEnabled:false});
  const page = await context.newPage();
  await page.setContent(html);
  const summary = page.locator('#resumen');
  const text = await summary.innerText();
  assert(!html.includes('Cargando análisis de'));
  for (const name of ['GROWTH','VALUE','QUALITY']) assert((await summary.textContent()).includes(name));
  const reasons = summary.locator('summary').filter({hasText:'Por qué tiene esta nota'});
  assert.equal(await reasons.count(),3);
  const components = summary.locator('summary').filter({hasText:'Componentes y datos necesarios'});
  assert.equal(await components.count(),3);
  for (const element of await reasons.all()) {
   const details = element.locator('..');
   assert((await details.textContent()).length > 80);
  }
  for (const element of await components.all()) {
   const details = element.locator('..');
   assert((await details.textContent()).includes('Periodo:'));
   assert((await details.textContent()).includes('peso'));
  }
  const before = await summary.textContent();
  console.log(`${ticker}: HTTP 200; three grades, explanations and weighted components in HTML without scripts`);
  await context.close();
  const liveContext = await browser.newContext();
  const live = await liveContext.newPage();
  const hydrationErrors=[];
  live.on('pageerror',e=>hydrationErrors.push(e.message));
  // Local server has no provider credentials: serve the unchanged public payload for client revalidation.
  if(origin.includes('localhost')) await live.route('**/api/stock?*',async route=>{
   const upstream=await fetch(`https://www.bulltrace.app/api/stock?ticker=${ticker}`);
   await route.fulfill({status:upstream.status,contentType:'application/json',body:await upstream.text()});
  });
  await live.goto(url,{waitUntil:'networkidle'});
  assert.equal(hydrationErrors.length,0,hydrationErrors.join('\n'));
  assert.equal(await live.locator('#resumen').textContent(),before);
  const first=live.getByText('Por qué tiene esta nota',{exact:true}).first();
  await first.click();
  assert(await first.locator('..').evaluate(e=>e.open));
  const refresh = live.getByRole('button',{name:'↻ Actualizar datos'});
  const refreshed = live.waitForResponse(r=>r.url().includes('/api/stock?')&&r.url().includes('refresh=true'));
  await refresh.click();
  assert.equal((await refreshed).status(),200);
  await refresh.waitFor({state:'visible'});
  assert.equal(await live.locator('#resumen').textContent(),before);
  console.log(`${ticker}: hydrated grades match server HTML; explanation toggle and refresh button available`);
  await liveContext.close();
 }
} finally {await browser.close();}
