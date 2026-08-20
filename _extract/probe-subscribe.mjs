import { chromium } from 'playwright';
const b=await chromium.launch();
for (const width of [1440, 390]) {
  const ctx=await b.newContext({viewport:{width,height:900}});
  const p=await ctx.newPage();
  await p.goto('https://lifeagentgrowthsystems.com/',{waitUntil:'load',timeout:90000});
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await p.waitForTimeout(8000);
  const outer=await p.evaluate(()=>{
    const f=document.querySelector('iframe[src*="gc6zaq82dMr6CinO3VSX"]');
    if(!f) return {none:true};
    const bx=(n)=>{const r=n.getBoundingClientRect();return {w:+r.width.toFixed(1),h:+r.height.toFixed(1)};};
    return {dataHeight:f.getAttribute('data-height'), iframe:bx(f),
      widget:bx(f.closest('.elementor-widget-container')),
      el:bx(f.closest('[data-id]')), elId:f.closest('[data-id]')?.dataset.id,
      style:f.getAttribute('style')};
  });
  const fr=p.frames().find(f=>f.url().includes('gc6zaq82dMr6CinO3VSX'));
  let inner=null;
  if(fr){ try{ inner=await fr.evaluate(()=>({
    docH:document.documentElement.scrollHeight,
    els:[...document.querySelectorAll('input,textarea,button,label,p,a')].map(e=>{
      const cs=getComputedStyle(e),r=e.getBoundingClientRect();
      return {tag:e.tagName,type:e.type||null,name:e.name||null,ph:e.placeholder||null,
        txt:(e.innerText||'').trim().slice(0,70),href:e.href||null,
        box:{x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)},
        bg:cs.backgroundColor,color:cs.color,font:`${cs.fontFamily.split(',')[0]} ${cs.fontSize} ${cs.fontWeight}`,
        radius:cs.borderRadius,pad:cs.padding,margin:cs.margin};})}));
  }catch(e){inner={err:String(e).slice(0,120)};} }
  console.log('###',width,JSON.stringify({outer,inner},null,1));
  await ctx.close();
}
await b.close();
