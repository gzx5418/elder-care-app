import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>{
 localStorage.setItem('silver.defaultProfile',JSON.stringify('bailian-v1'));
 localStorage.setItem('silver.settings',JSON.stringify({mode:'offline',provider:'qwen',autoRead:false}));
 window.androidBridge={};window.calls=[];window.calendarDenied=false;window.events={};
 const methods={ElderNative:['calendar','deleteCalendar','stopSpeaking'],LocalNotifications:['checkPermissions','requestPermissions','checkExactNotificationSetting','createChannel','cancel','schedule','registerActionTypes','removeDeliveredNotifications'],App:[]};
 window.Capacitor={PluginHeaders:Object.entries(methods).map(([name,list])=>({name,methods:list.map(name=>({name,rtype:'promise'}))})),nativeCallback:()=> 'mock-listener',nativePromise:async(plugin,method,options)=>{
  window.calls.push({plugin,method,options});
  if(method==='calendar'){
   if(window.calendarDenied)throw new Error('日历权限未开启');
   const id=options.eventId||window.events[options.reminderId]||Object.keys(window.events).length+100;
   window.events[options.reminderId]=id;return {eventId:id};
  }
  if(method==='deleteCalendar'){delete window.events[options.reminderId];return {};}
  if(method==='checkPermissions'||method==='requestPermissions')return {display:'granted'};
  if(method==='checkExactNotificationSetting')return {exact_alarm:'granted'};
  return {};
 }};
});
const page=await context.newPage(),passed=[];
const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
try{
 await page.goto('http://127.0.0.1:8080/#memo');
 await check('保存通用提醒自动调用日历且无同步确认',async()=>{await page.getByRole('button',{name:'添加提醒',exact:true}).click();assert.equal(await page.locator('#memo-type').inputValue(),'其他');await page.locator('#memo-title').fill('去买菜');await page.getByRole('button',{name:'保存提醒',exact:true}).click();await page.getByText('日历已同步',{exact:true}).waitFor();const c=await page.evaluate(()=>window.calls.filter(x=>x.method==='calendar'));assert.equal(c.length,1);assert.equal(c[0].options.title,'去买菜');assert.equal(c[0].options.minutes,0);assert.ok(c[0].options.reminderId);assert.equal(await page.locator('#confirm-yes').count(),0);});
 await check('编辑更新同一个日历事件',async()=>{const old=await page.evaluate(()=>JSON.parse(localStorage.getItem('silver.memos'))[0]);await page.getByRole('button',{name:'管理',exact:true}).click();assert.equal(await page.getByRole('button',{name:'同步到系统日历',exact:true}).count(),0);await page.getByRole('button',{name:'修改提醒',exact:true}).click();await page.locator('#memo-title').fill('去超市买水果');await page.getByRole('button',{name:'保存提醒',exact:true}).click();await page.getByText('日历已同步',{exact:true}).waitFor();const c=await page.evaluate(()=>window.calls.filter(x=>x.method==='calendar'));assert.equal(c.at(-1).options.eventId,old.calendarEventId);assert.equal(c.at(-1).options.title,'去超市买水果');assert.equal(await page.evaluate(()=>Object.keys(window.events).length),1);});
 await check('日历权限失败仍保留提醒并显示真实状态',async()=>{await page.evaluate(()=>window.calendarDenied=true);await page.getByRole('button',{name:'添加提醒',exact:true}).click();await page.locator('#memo-title').fill('去散步');await page.getByRole('button',{name:'保存提醒',exact:true}).click();await page.getByText('日历未同步，请检查日历权限',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('silver.memos')).length),2);await page.evaluate(()=>window.calendarDenied=false);});
 await check('删除提醒同时删除关联日历事件',async()=>{const item=page.locator('.memo-item').filter({hasText:'去超市买水果'});await item.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'删除提醒',exact:true}).click();await page.locator('#confirm-yes').click();await item.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.calls.filter(x=>x.method==='deleteCalendar').length),1);assert.equal(await page.evaluate(()=>Object.keys(window.events).length),0);});
 await writeFile('test-results/calendar-ui.json',JSON.stringify({passed,nativeBridge:'mock',hardwareVerified:false},null,2));
}finally{await browser.close();}
