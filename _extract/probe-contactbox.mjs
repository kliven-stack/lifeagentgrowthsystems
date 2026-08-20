import { chromium } from 'playwright';
const b=await chromium.launch();
for (const [label,origin] of [['LIVE','https://lifeagentgrowthsystems.com'],['CLONE',process.env.CLONE_ORIGIN]]) {
  if(!origin) continue;
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  const p=await ctx.newPage();
  await p.goto(origin+'/',{waitUntil:'load',timeout:90000});
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await p.waitForTimeout(7000);
  console.log(label, JSON.stringify(await p.evaluate(()=>{
    const el=document.querySelector('[data-id="ee9032b"]');
    const r=el?.getBoundingClientRect();
    const sec=document.getElementById('contact-us');
    return {widget:r?{w:+r.width.toFixed(1),h:+r.height.toFixed(1)}:null,
            anchorExists:!!sec, pageH:document.documentElement.scrollHeight};
  })));
  await ctx.close();
}
await b.close();
