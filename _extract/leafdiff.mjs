import { chromium } from 'playwright';
const LIVE='https://lifeagentgrowthsystems.com', CLONE=process.env.CLONE_ORIGIN||'http://localhost:4331';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.route('**/*.{mp4,mov,webm}',(r)=>r.abort());
await ctx.route('**://verified.trustymail.co/**',(r)=>r.abort());
await ctx.route('**://*.leadconnectorhq.com/**',(r)=>r.abort());
await ctx.route('**://links.sybrware.com/**',(r)=>r.abort());
const grab=async(o)=>{const t=await ctx.newPage();await t.bringToFront();
  await t.goto(o+'/',{waitUntil:'load',timeout:90000});
  await t.evaluate(()=>document.fonts.ready);
  await t.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await t.waitForTimeout(1200);
  await t.evaluate(()=>window.scrollTo(0,0));await t.waitForTimeout(800);
  await t.evaluate(()=>{for(const el of document.querySelectorAll('.elementor-main-swiper, .e-n-carousel')){if(el.swiper){el.swiper.autoplay?.stop();el.swiper.slideToLoop(0,0);}else if(el.eCarousel)el.eCarousel.reset();}});
  await t.waitForTimeout(250);
  const r=await t.evaluate(()=>{
    const L='h1, h2, h3, h4, h5, h6, p, li, a, img, blockquote, time, .entry-title, .page-header, .page-content, .comments-area, .comment-body, .nav-links';
    const out=[];
    document.querySelectorAll(L).forEach((el)=>{
      if(el.closest('.swiper-slide-duplicate')||el.closest('.elementor-sticky__spacer'))return;
      out.push(el.tagName.toLowerCase()+' :: '+((el.innerText||'').replace(/\s+/g,' ').trim().slice(0,42))+' :: '+(el.closest('[data-widget_type]')?.getAttribute('data-widget_type')||''));
    });
    const sw=[...document.querySelectorAll('.swiper,.swiper-container')].map(c=>({w:c.closest('[data-widget_type]')?.getAttribute('data-widget_type'),n:c.querySelector('.swiper-wrapper').children.length,dup:c.querySelectorAll('.swiper-slide-duplicate').length}));
    return {out,sw};
  });
  await t.close();return r;};
const a=await grab(LIVE), c=await grab(CLONE);
console.log('LIVE swipers ',JSON.stringify(a.sw));
console.log('CLONE swipers',JSON.stringify(c.sw));
console.log('leaves live=%d clone=%d',a.out.length,c.out.length);
for(let i=0;i<Math.max(a.out.length,c.out.length);i++){
  if(a.out[i]!==c.out[i]){console.log('FIRST DIVERGENCE at',i);
    for(let k=Math.max(0,i-3);k<i+10;k++)console.log(' ',k,'\n    L:',a.out[k],'\n    C:',c.out[k]);
    break;}
}
await b.close();
