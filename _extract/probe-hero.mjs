import { chromium } from 'playwright';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900}});
const p=await ctx.newPage();
await p.goto('https://lifeagentgrowthsystems.com/',{waitUntil:'load',timeout:90000});
await p.evaluate(()=>document.fonts.ready);
console.log(JSON.stringify(await p.evaluate(()=>{
  const out=[];
  for (const h of document.querySelectorAll('h1,h2,h3')) {
    const ff=getComputedStyle(h).fontFamily;
    if (/-apple-system/.test(ff)) {
      const w=h.closest('[data-id]');
      out.push({tag:h.tagName, txt:(h.innerText||'').slice(0,60), id:w?.dataset.id,
                widget:h.closest('[data-widget_type]')?.getAttribute('data-widget_type'),
                cls:h.className, page:location.pathname});
    }
  }
  return out;
}),null,1));
await ctx.close(); await b.close();
