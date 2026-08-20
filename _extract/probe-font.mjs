import { chromium } from 'playwright';
const b=await chromium.launch();
for (const [label,origin] of [['CLONE',process.env.CLONE_ORIGIN||'http://localhost:4331'],['LIVE','https://lifeagentgrowthsystems.com']]) {
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  await ctx.route('**://verified.trustymail.co/**',(r)=>r.abort());
  const p=await ctx.newPage();
  await p.goto(origin+'/',{waitUntil:'load',timeout:90000});
  await p.evaluate(()=>document.fonts.ready);
  console.log(label, JSON.stringify(await p.evaluate(()=>{
    const els=[...document.querySelectorAll('h1,h2')].slice(0,4);
    return els.map(h=>({tag:h.tagName,txt:(h.innerText||'').slice(0,28),ff:getComputedStyle(h).fontFamily}));
  })));
  await ctx.close();
}
await b.close();
