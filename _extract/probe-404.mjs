import { chromium } from 'playwright';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900}});
const p=await ctx.newPage();
const bad=[];
p.on('response',(r)=>{ if(r.status()>=400) bad.push(r.status()+' '+r.url()); });
p.on('requestfailed',(r)=>bad.push('FAIL '+r.url()+' '+(r.failure()?.errorText||'')));
for (const path of ['/','/about/','/schedule-a-call/','/home-2/','/google-my-business-walkthrough/']) {
  bad.length=0;
  await p.goto((process.env.CLONE_ORIGIN||'http://localhost:4331')+path,{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(2500);
  console.log('---', path); bad.forEach(x=>console.log('   ',x.slice(0,150)));
}
await b.close();
