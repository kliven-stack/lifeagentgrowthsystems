import { chromium } from 'playwright';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.route('**://verified.trustymail.co/**',(r)=>r.abort());
const p=await ctx.newPage();
p.on('console',(m)=>console.log('PAGE:',m.type(),m.text().slice(0,200)));
p.on('pageerror',(e)=>console.log('PAGEERROR:',String(e).slice(0,300)));
await p.goto((process.env.CLONE_ORIGIN||'http://localhost:4331')+'/',{waitUntil:'load'});
await p.waitForTimeout(600);
await p.locator('header .elementor-sticky--active nav.elementor-nav-menu--main li.contact-form > a').first().click();
await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(async ()=>{
  const form=document.querySelector('#elementor-popup-modal-394 form.gm-form__form');
  if(!form) return {noForm:true};
  form.querySelector('[name="full_name"]').value='Test';
  form.querySelector('[name="email"]').value='t@example.com';
  form.querySelector('[name="phone"]').value='5555555555';
  form.querySelector('[name="message"]').value='Hi';
  form.querySelector('[name="website"]').value='spam';
  let sawSubmit=false, defaultPrevented=null;
  document.addEventListener('submit',(e)=>{sawSubmit=true;setTimeout(()=>{},0);defaultPrevented=e.defaultPrevented;},true);
  form.requestSubmit();
  await new Promise(r=>setTimeout(r,800));
  const st=form.querySelector('.gm-form__status');
  return {sawSubmit, defaultPrevented, statusText:st.textContent, state:st.dataset.state,
          emailAfter:form.querySelector('[name="email"]').value, endpoint:form.dataset.endpoint,
          valid:form.checkValidity()};
}),null,1));
await b.close();
