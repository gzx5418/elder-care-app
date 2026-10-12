import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>{
  localStorage.setItem('silver.defaultProfile',JSON.stringify('bailian-v1'));
  localStorage.setItem('silver.settings',JSON.stringify({mode:'ai',provider:'qwen',saveKey:true,autoRead:true,asrModel:'FunAudioLLM/SenseVoiceSmall'}));
  localStorage.setItem('silver.key','test-dummy');
  window.speechSynthesis.getVoices=()=>[];
  window.played=0;window.paused=0;
  window.Audio=class {async play(){window.played++;setTimeout(()=>this.onended?.(),0);}pause(){window.paused++;this.onpause?.();}};
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});
  window.AudioContext=class {async resume(){}async close(){}createMediaStreamSource(){return {connect(){}}}createAnalyser(){const start=performance.now();return {fftSize:1024,getFloatTimeDomainData(data){data.fill(!window.silent&&performance.now()-start<1000?.1:0);}}}};
  window.MediaRecorder=class {mimeType='audio/webm';state='inactive';start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['fake-recording'],{type:this.mimeType})});this.onstop();}};
});
const page=await context.newPage(),passed=[],errors=[];let asr=0,tts=[],chat=0,nextTranscript='怎么给手机交话费';
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://dashscope.aliyuncs.com/**',async route=>{
 const b=route.request().postDataJSON();
 if(b.model==='qwen3-tts-flash'){tts.push(b.input.text);await route.fulfill({json:{output:{audio:{url:'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/test.wav'}}}});}
 else if(b.model==='qwen3-asr-flash'){asr++;assert.match(b.messages[0].content[0].input_audio.data,/^data:audio\/webm;base64,/);await route.fulfill({json:{choices:[{message:{content:nextTranscript}}]}});}
 else {chat++;await route.fulfill({json:{choices:[{message:{content:'这是联网生成的补充答案，请核对充值号码。'}}]}});}
});
const check=async(name,run)=>{await run();passed.push(name);console.log('PASS '+name);};
try{
 await page.goto('http://127.0.0.1:8080/#life');
 await check('升级迁移旧语音模型',async()=>assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('silver.settings')).asrModel),'qwen3-asr-flash'));
 await check('无系统识别服务仍可录音并回填',async()=>{await page.getByRole('button',{name:'点一下说话',exact:true}).click();assert.equal(await page.locator('#confirm-yes').count(),0);assert.equal(await page.getByRole('button',{name:'说完了',exact:true}).count(),0);await page.waitForFunction(()=>document.querySelector('#question').value==='怎么给手机交话费');assert.equal(asr,1);});
 await check('录音取消不上传',async()=>{await page.getByRole('button',{name:'点一下说话',exact:true}).click();await page.getByRole('button',{name:'取消录音',exact:true}).click();assert.equal(asr,1);});
 await check('自动朗读含联网答案并使用云语音兜底',async()=>{await page.getByRole('button',{name:'帮我解答',exact:true}).click();await page.waitForFunction(()=>window.played===1);assert.match(tts[0],/联网生成的补充答案/);});
 await check('停止与再次朗读',async()=>{await page.getByRole('button',{name:'停止朗读',exact:true}).click();assert.equal(await page.evaluate(()=>window.paused),1);await page.getByRole('button',{name:'再次朗读',exact:true}).click();await page.waitForFunction(()=>window.played===2);});
 await check('急症立即展示且不调用云服务',async()=>{const n=tts.length,c=chat;await page.goto('http://127.0.0.1:8080/#health');await page.locator('#question').fill('胸痛喘不过气');await page.getByRole('button',{name:'查看健康建议',exact:true}).click();await page.locator('.emergency').waitFor();assert.equal(tts.length,n);assert.equal(chat,c);});
 await check('关闭自动朗读后不再自动合成',async()=>{await page.goto('http://127.0.0.1:8080/#settings');await page.locator('[name=autoRead]').uncheck();await page.getByRole('button',{name:'保存设置',exact:true}).click();const n=tts.length;await page.goto('http://127.0.0.1:8080/#life');await page.locator('#question').fill('怎么交话费');await page.getByRole('button',{name:'帮我解答',exact:true}).click();await page.locator('#ai-answer .ai-note').waitFor();assert.equal(tts.length,n);});
 await check('窄屏和特大字体按钮不挤成长列',async()=>{for(const width of [320,390,424]){await page.setViewportSize({width,height:844});for(const large of [false,true]){await page.evaluate(x=>document.body.classList.toggle('large',x),large);for(const b of await page.locator('.action-row .btn').all()){const box=await b.boundingBox();assert.ok(box.height<110,`${width}/${large}: ${box.height}`);}assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}}await page.screenshot({path:'test-results/life-voice-fixed.png',fullPage:true});});
 await check('联网未匹配只显示AI答案，无离线未找到提示',async()=>{await page.locator('#question').fill('怎样办理老年公交优惠卡');await page.getByRole('button',{name:'帮我解答',exact:true}).click();await page.locator('#ai-answer .ai-note').waitFor();assert.doesNotMatch(await page.locator('#answer').innerText(),/没有找到|离线指引/);});
 await check('没有讲话时自动退出且不上传',async()=>{const n=asr;await page.evaluate(()=>window.silent=true);await page.getByRole('button',{name:'点一下说话',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#recording-area').textContent==='',{timeout:12000});assert.equal(asr,n);await page.evaluate(()=>window.silent=false);});
 await check('提醒页直接语音设置通用事项，无保存确认步骤',async()=>{await page.goto('http://127.0.0.1:8080/#memo');nextTranscript='提醒我明天下午三点去超市买菜';await page.getByRole('button',{name:'语音设置提醒',exact:true}).click();await page.locator('.memo-item').waitFor();assert.match(await page.locator('.memo-item').innerText(),/去超市买菜/);assert.match(await page.locator('.memo-item').innerText(),/15:00/);assert.equal(await page.locator('dialog[open]').count(),0);const m=await page.evaluate(()=>JSON.parse(localStorage.getItem('silver.memos'))[0]);assert.equal(m.type,'其他');assert.equal(m.daily,false);assert.equal(m.calendarStatus,'web');await page.screenshot({path:'test-results/general-reminders.png',fullPage:true});});
 await check('语音提醒缺少时间时要求补充，避免默认错误时间',async()=>{nextTranscript='提醒我明天吃药';await page.getByRole('button',{name:'语音设置提醒',exact:true}).click();await page.getByRole('button',{name:'补充后保存提醒',exact:true}).waitFor();assert.equal(await page.locator('#memo-at').inputValue(),'');assert.match(await page.locator('#memo-voice-summary').innerText(),/补充几点/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('silver.memos')).length),1);await page.getByRole('button',{name:'取消',exact:true}).click();});
 assert.deepEqual(errors,[]);await writeFile('test-results/speech-ui.json',JSON.stringify({passed,errors},null,2));
}finally{await browser.close();}
