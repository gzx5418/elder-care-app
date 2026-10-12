import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReminder,silenceDetector} from '../src/voice-flow.js';
const now=new Date(2026,9,9,20,38);
for(const [text,day,hour,minute,title,daily] of [
 ['提醒我明天早上八点吃药',10,8,0,'吃药',false],
 ['提醒我每天早上八点吃药',10,8,0,'吃药',true],
 ['提醒我后天下午三点半去医院复诊',11,15,30,'去医院复诊',false],
 ['提醒我明天晚上八点三十分喝水',10,20,30,'喝水',false],
 ['提醒我明天8:15吃药',10,8,15,'吃药',false],
 ['提醒我下周一上午九点缴费',12,9,0,'缴费',false],
 ['提醒我三十分钟后喝水',9,21,8,'喝水',false],
 ['提醒我明天早上八点一刻吃药',10,8,15,'吃药',false],
 ['提醒我明天早上八点三刻吃药',10,8,45,'吃药',false],
])test(text,()=>{const p=parseReminder(text,now);assert.ok(p.complete,p.error);assert.equal(p.at.getDate(),day);assert.equal(p.at.getHours(),hour);assert.equal(p.at.getMinutes(),minute);assert.equal(p.title,title);assert.equal(p.daily,daily);});
for(const text of ['提醒我明天吃药','提醒我明天二十五点吃药','提醒我今天早上八点吃药','提醒我2月30日八点吃药','提醒我明天八点'])test('不猜测无效或缺失信息：'+text,()=>assert.equal(parseReminder(text,now).complete,false));
test('停顿两秒结束，短暂停顿继续',()=>{const d=silenceDetector();for(let t=0;t<=1000;t+=100)assert.equal(d(.1,t),'listening');assert.equal(d(0,2000),'listening');assert.equal(d(0,3000),'finish');});
test('开头安静不上传，8秒退出',()=>{const d=silenceDetector();assert.equal(d(0,0),'listening');assert.equal(d(0,7999),'listening');assert.equal(d(0,8000),'empty');});
test('单个短噪声不当作讲话',()=>{const d=silenceDetector();d(0,0);d(.1,100);assert.equal(d(0,2100),'listening');assert.equal(d(0,8000),'empty');});
