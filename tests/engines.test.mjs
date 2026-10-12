import test from 'node:test';
import assert from 'node:assert/strict';
import { searchLifeAnswer, assessFraud, assessHealth, desensitizeText } from '../src/engines.js';
import { life,health,emergencies } from '../src/data.js';
import { reserveUsage, localDay, nextOccurrence } from '../src/store.js';
const records=new Map();globalThis.localStorage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
for(const item of life)test(`生活知识：${item.title}`,()=>assert.equal(searchLifeAnswer(item.words[0]).id,item.id));
test('生活同义词：缴纳电力费用',()=>assert.equal(searchLifeAnswer('如何缴纳电力费用').id,'utilities'));
test('未知生活问题有兜底',()=>assert.match(searchLifeAnswer('宇宙飞船').intro,/暂时/));
const fraudCases=[
  ['【工商银行】您的账户涉嫌洗钱，请立即点击链接解冻，否则将被冻结','high'],
  ['我是公安局的，您涉嫌违法，请把钱转到安全账户配合调查，否则将逮捕您','high'],
  ['您的账户已被冻结，请立即转账到安全账户解冻，验证码请勿泄露','high'],
  ['您的快递有异常，请加客服 QQ 处理，否则退回','medium'],
  ['您有一笔退款待领取，请点击链接确认身份信息','high'],
  ['妈，今天晚上回家吃饭吗，我想做红烧肉','low'],
  ['明天记得去医院复查血压，带上医保卡','low'],
  ['您的快递已签收，如有疑问请联系快递员','low'],
  ['您预约的挂号已成功，请在周五上午9点到医院就诊','low'],
  ['【95588】请点击链接输入银行卡密码解冻','high'],
  ['请把验证码发给我','high'],
  ['中奖后先交保证金','high'],
  ['刷单赚佣金','high'],
  ['请共享屏幕方便远程控制','high'],
  ['医保即将停用，请加客服微信','medium']
];
for(const [text,level] of fraudCases)test(`反诈：${text}`,()=>assert.equal(assessFraud(text).level,level));
test('已转账应急分流',()=>assert.equal(assessFraud('我已经转账到安全账户').action,'paid'));
test('已给验证码分流',()=>assert.equal(assessFraud('我已经给了验证码').action,'code'));
test('已点链接分流',()=>assert.equal(assessFraud('我点了链接').action,'clicked'));
for(const [category,words] of emergencies)test(`急症：${category}`,()=>{for(const w of words)assert.equal(assessHealth('家人突然'+w).emergency,true,w);});
for(const item of health)test(`健康科普：${item.title}`,()=>assert.equal(assessHealth(item.words[0]).emergency,false));
test('普通头痛不误判急症',()=>assert.equal(assessHealth('普通头痛如何就医').emergency,false));
test('单一否定症状不报警',()=>assert.equal(assessHealth('没有胸痛，问下高血压饮食').emergency,false));
test('家人急症不被另一句否定覆盖',()=>assert.equal(assessHealth('家人胸痛，我没有胸痛').emergency,true));
test('隐私脱敏五种信息',()=>{const text='13800138000 身份证11010119490101123X 银行卡6222021234567890123 验证码：123456 a@example.com';const result=desensitizeText(text);for(const secret of ['13800138000','11010119490101123X','6222021234567890123','123456','a@example.com'])assert.ok(!result.includes(secret),secret);});
test('每日30次联网额度，31次拒绝',()=>{records.clear();for(let i=1;i<=30;i++)assert.equal(reserveUsage(),i);assert.throws(()=>reserveUsage(),/30/);});
test('跨日重新计算联网额度',()=>{records.set('silver.usage',JSON.stringify({day:'2000-01-01',count:30}));assert.equal(reserveUsage(),1);assert.equal(JSON.parse(records.get('silver.usage')).day,localDay());});
test('每天重复提醒滚动到未来',()=>{const now=new Date('2026-10-09T12:00:00+08:00');const m={daily:true,at:'2026-10-08T08:00:00+08:00'};const next=nextOccurrence(m,now);assert.ok(next>now);assert.equal(next.getDate(),10);});
