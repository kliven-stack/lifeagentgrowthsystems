import { chromium } from 'playwright';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.route('**://verified.trustymail.co/**',(r)=>r.abort());
const p=await ctx.newPage();
await p.goto((process.env.CLONE_ORIGIN||'http://localhost:4331')+'/about/',{waitUntil:'load'});
await p.waitForTimeout(500);
await p.locator('header .elementor-sticky--active li.contact-form > a').first().click();
await p.waitForTimeout(600);
console.log(JSON.stringify(await p.evaluate(()=>{
  const m=document.querySelector('#elementor-popup-modal-394');
  const cs=getComputedStyle(m); const r=m.getBoundingClientRect();
  const at=document.elementFromPoint(4,4);
  const content=m.querySelector('.dialog-widget-content');
  const cr=content.getBoundingClientRect();
  return {modalBox:{x:r.x,y:r.y,w:r.width,h:r.height}, pos:cs.position, display:cs.display,
    inset:[cs.top,cs.right,cs.bottom,cs.left].join(' '),
    atPoint:at? at.tagName+'.'+String(at.className).slice(0,80):null,
    atIsModal: at===m,
    contentBox:{x:cr.x,y:cr.y,w:cr.width,h:cr.height}};
},null),null,1));
await b.close();
