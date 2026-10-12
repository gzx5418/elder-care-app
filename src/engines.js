import { life, health, emergencies, fraudRules } from './data.js';
export const disclaimer = '仅供健康科普参考，不能替代医生诊断、治疗和专业急救指导。';
export function searchLifeAnswer(text) {
  const q = text.toLowerCase();
  const found = life.map(item => ({item, score:item.words.filter(w => q.includes(w)).reduce((a,w) => a + w.length,0)})).sort((a,b) => b.score-a.score)[0];
  return found?.score ? {...found.item} : {unmatched:true,title:'我陪您一步一步来',intro:'暂时没有找到对应的离线指引。您可以试试“怎么交话费”“怎么挂号”，或者请家人帮忙。',steps:[],tip:'涉及转账、密码或验证码时，先核实再操作。'};
}
export function assessFraud(text) {
  const reasons=[]; let score=0;
  for (const [word,points,reason] of fraudRules) if(text.includes(word)){ score+=points; reasons.push(reason); }
  const link = /https?:\/\/|www\.|点击链接|点此|网址|短链接|链接/i.test(text);
  const sensitive = /转账|验证码|银行卡|密码|身份信息|身份证|付款|汇款|解冻|下载|安装|退款/.test(text);
  if(link){score+=15; reasons.push('信息含链接，需独立核实来源');}
  if(link && sensitive){score=Math.max(70,score); reasons.push('链接与敏感操作同时出现，请停止操作');}
  if(/(?:提供|发送|告诉|告知|索要|给我|发我|发给|回复).{0,8}(?:验证码|密码)|(?:验证码|密码).{0,8}(?:发给|告诉|发送|提供)/.test(text)){score=Math.max(70,score);reasons.push('对方索要验证码或密码');}
  if(/快递.*异常|加.*(?:QQ|微信)|医保.*停用|白条.*提额|退款.*领取|会员.*扣费/.test(text)){score+=30;reasons.push('异常、退款或加好友的消息需要官方核实');}
  // 官方电话不构成白名单豁免：同一消息含敏感操作仍保留风险。
  score=Math.min(100,score);
  const level=score>=60?'high':score>=30?'medium':'low';
  return {score,level,title:level==='high'?'高风险，请先停下来':level==='medium'?'有疑点，先向官方核实':'暂未发现明显诈骗信号',reasons:reasons.length?reasons:['本地规则暂未命中，仍需核实发送者身份。低风险不代表绝对安全。'], action:/已(?:经)?(?:转账|汇款|付款)|转了钱/.test(text)?'paid':/已.*(?:验证码|密码)/.test(text)?'code':/已.*(?:链接|点击)|点了链接/.test(text)?'clicked':'none'};
}
export function assessHealth(text) {
  // 只在明确询问者自身的否定片段中排除；“家人胸痛，我没有胸痛”仍应报警。
  const clauses=text.split(/[，。！？,;；\n]/).filter(c=>!/(?:没有|无|未出现|不伴有|不再有).{0,6}(?:胸痛|胸闷|呼吸困难|昏迷|出血|头痛)/.test(c));
  const active=clauses.join('，');
  const hit=emergencies.find(([,words])=>words.some(w=>active.includes(w)));
  if(hit) return {emergency:true,title:`发现${hit[0]}危险信号`,intro:'请立即拨打 120，不要等待在线回答。',steps:['拨打 120，说明准确地址、症状和联系电话。','留在安全的地方，尽量让家人或身边的人陪同。','听从急救调度员指导，不自行用药或盲目搬动。'],tip:disclaimer};
  const item=health.find(i=>i.words.some(w=>text.includes(w)));
  return {emergency:false,...(item || {title:'关心身体，从日常开始',intro:'可询问血压、血糖、饮食、运动、睡眠和防跌倒。持续不适应及时到正规医院就诊。',steps:[],tip:'不要仅凭应用内容判断病情。'}),disclaimer};
}
export function desensitizeText(text) {
  return text.replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g,'[邮箱已隐藏]')
    .replace(/\b\d{17}[\dXx]\b/g,'[身份证已隐藏]')
    .replace(/\b\d{16,19}\b/g,'[银行卡已隐藏]')
    .replace(/1[3-9]\d{9}/g,'[手机号已隐藏]')
    .replace(/((?:验证码|密码)[：:\s是为]*)\d{4,8}/g,'$1[已隐藏]');
}
export const emergencyPlans = {
  none:['不要点击链接、转账或提供验证码。','通过官方 App 或自己查到的客服电话核实。','保存可疑信息，和家人商量；需要时拨打 96110。'],
  clicked:['立即停止输入密码和验证码。','关闭可疑页面；如安装了陌生软件，请停止使用并寻求专业帮助。','通过官方渠道联系银行确认账户安全，必要时拨打 110。'],
  paid:['立即拨打 110 报警，并联系银行申请止付。','保存转账凭证、收款账号、短信和聊天记录。','不要相信“付费追回资金”，按警方指引处理。'],
  code:['立即通过官方渠道联系银行或相关平台，告知验证码可能泄露。','按官方指引修改密码、冻结或保护账户。','保存证据，如发生资金损失立即拨打 110。']
};
