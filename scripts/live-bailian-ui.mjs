// 与真实百炼 API 验证预置配置：只记录状态和模型，不记录密钥/请求头。
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const p=await b.newPage({viewport:{width:390,height:844}});const calls=[];const errors=[];
p.on('pageerror',e=>errors.push(e.message));
p.on('response',async r=>{if(r.url().startsWith('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')){const body=r.request().postDataJSON();calls.push({status:r.status(),model:body.model,thinkingDisabled:body.enable_thinking===false});}});
try{
  await p.goto('http://127.0.0.1:8080/#settings');
  assert.equal(await p.locator('#mode').inputValue(),'ai');assert.equal(await p.locator('#provider').inputValue(),'qwen');assert.equal(await p.locator('#text-model').inputValue(),'qwen-flash');
  assert.equal(await p.locator('#api-key').inputValue(),'');
  await p.getByRole('button',{name:'测试已保存的 AI 配置'}).click();await p.getByText('连接成功：阿里云百炼 · qwen-flash',{exact:true}).waitFor();
  await p.screenshot({path:'test-results/bailian-settings-mobile.png',fullPage:true});
  await p.goto('http://127.0.0.1:8080/#life');await p.locator('#question').fill('怎么给手机交话费');await p.getByRole('button',{name:'帮我解答',exact:true}).click();await p.locator('#ai-answer .ai-note').waitFor({timeout:40000});
  const before=calls.length;await p.goto('http://127.0.0.1:8080/#health');await p.locator('#question').fill('家人胸痛');await p.getByRole('button',{name:'查看健康建议',exact:true}).click();await p.locator('.emergency').waitFor();assert.equal(calls.length,before);
  await p.goto('http://127.0.0.1:8080/#settings');await p.getByRole('button',{name:'停用预置密钥并清除个人密钥'}).click();assert.equal(await p.locator('#mode').inputValue(),'offline');await p.reload();assert.equal(await p.locator('#mode').inputValue(),'offline');assert.equal(await p.evaluate(()=>localStorage.getItem('silver.bundledKeyDisabled')),'true');
  assert.ok(calls.length>=2);assert.ok(calls.every(c=>c.status===200&&c.model==='qwen-flash'&&c.thinkingDisabled));assert.deepEqual(errors,[]);
  await writeFile('test-results/bailian-live-ui.json',JSON.stringify({passed:true,calls,checks:['默认AI与百炼配置','密钥不显示在输入框','真实连接测试','真实生活问答','急症不调用AI','停用密钥重开后不恢复'],errors},null,2));
  console.log('PASS 百炼默认配置与真实接口集成（6项检查）');
}finally{await b.close();}
