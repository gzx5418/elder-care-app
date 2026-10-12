// Pure helpers shared by microphone monitoring and reminder interpretation.
export function silenceDetector({silenceMs=2000,noSpeechMs=8000,threshold=0.018}={}){
  let start=null,lastVoice=null,voiceMs=0,previous=null;
  return (level,now)=>{
    if(start===null)start=now;
    const elapsed=previous===null?0:Math.min(250,now-previous);previous=now;
    if(level>=threshold){voiceMs+=elapsed;lastVoice=now;}
    if(voiceMs>=250&&lastVoice!==null&&now-lastVoice>=silenceMs)return 'finish';
    if(voiceMs<250&&now-start>=noSpeechMs)return 'empty';
    return 'listening';
  };
}
function number(value){
  if(/^\d+$/.test(value))return Number(value);
  const digits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  if(value.includes('十')){const [a,b]=value.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0);}
  return digits[value];
}
const numeral='[零〇一二两三四五六七八九十\\d]+';
export function parseReminder(input,now=new Date()){
  let text=input.replace(/[，。！？,!?]/g,' ').trim(),daily=/每天|每日|天天/.test(text);
  const date=new Date(now);date.setSeconds(0,0);let explicit=false,hasTime=false,error='';
  const day=text.match(/大后天|后天|明天|今天|今晚|明早|明晚/);
  const week=text.match(/(下周|下星期|本周|这周|周|星期|礼拜)([一二三四五六日天])/);
  const calendar=text.match(new RegExp(`(?:(\\d{4})年)?(${numeral})月(${numeral})[日号]`));
  if(day){const n=/大后天/.test(day[0])?3:/后天/.test(day[0])?2:/明/.test(day[0])?1:0;date.setDate(date.getDate()+n);explicit=true;}
  else if(week){const weekday={一:1,二:2,三:3,四:4,五:5,六:6,日:0,天:0}[week[2]];let offset=weekday-date.getDay();if(/下/.test(week[1]))offset=((weekday+6)%7)-((date.getDay()+6)%7)+7;else if(offset<0)offset+=7;date.setDate(date.getDate()+offset);explicit=true;}
  else if(calendar){const year=calendar[1]?Number(calendar[1]):date.getFullYear(),month=number(calendar[2]),d=number(calendar[3]);date.setFullYear(year,month-1,d);explicit=true;if(date.getMonth()!==month-1||date.getDate()!==d)error='日期无效，请检查月份和日期。';}
  const relative=text.match(new RegExp(`(${numeral})(分钟|小时)(?:之后|以后|后)`));
  const clock=text.match(new RegExp(`(${numeral})(?:点|时)(?:(半|一刻|三刻)|(${numeral})分?)?`))||text.match(/(\d{1,2})[:：](\d{2})/);
  if(relative){const n=number(relative[1]);date.setTime(now.getTime()+n*(relative[2]==='小时'?3600000:60000));date.setSeconds(0,0);hasTime=true;explicit=true;}
  else if(clock){let hour=number(clock[1]),minute=clock[3]?number(clock[3]):clock[2]==='半'?30:clock[2]==='一刻'?15:clock[2]==='三刻'?45:clock[2]?number(clock[2]):0;
    if(/下午|傍晚|晚上|夜里|明晚|今晚/.test(text)&&hour<12)hour+=12;
    if(/中午/.test(text)&&hour<11)hour+=12;
    if(/凌晨|早上|早晨|上午|明早/.test(text)&&hour===12)hour=0;
    hasTime=hour>=0&&hour<24&&minute>=0&&minute<60;if(hasTime)date.setHours(hour,minute,0,0);else error='时间无效，请检查小时和分钟。';
    if(hasTime&&!explicit&&date<=now)date.setDate(date.getDate()+1);
  }
  if(/每周|每星期|每月|周末|月底|下个月/.test(text))error='请在下方选择具体提醒日期；暂不支持这类重复或模糊日期。';
  if(!hasTime&&!error)error='请补充几点提醒，再确认设置。';
  if(hasTime&&explicit&&!daily&&date<=now&&!error)error='这个时间已经过去，请修改提醒时间。';
  let title=text.replace(/(?:请)?(?:提醒我|提醒一下我|帮我设置(?:一个)?提醒|提醒)/g,'').replace(/每天|每日|天天/g,'');
  for(const matched of [calendar,week,day,relative,clock])if(matched)title=title.replace(matched[0],'');
  title=title.replace(/早上|早晨|上午|中午|下午|傍晚|晚上|凌晨|夜里/g,'').replace(/^[在到的\s]+|[\s]+$/g,'').trim();
  if(!title&&!error)error='请补充要提醒的事情。';
  const type=/吃药|服药|服用|用药/.test(title)?'吃药':/喝水|饮水/.test(title)?'喝水':/复诊|复查|看病|医院/.test(title)?'复诊':/缴费|交费|话费|水电费/.test(title)?'缴费':/生日/.test(title)?'生日':'其他';
  return {title:title.slice(0,80),type,daily,at:hasTime&&!error?date:null,error,complete:Boolean(hasTime&&title&&!error)};
}
