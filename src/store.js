export const defaults={mode:'ai',provider:'qwen',model:'qwen-flash',visionModel:'qwen3-vl-flash',asrModel:'qwen3-asr-flash',autoRead:true,dialect:'mandarin',large:false,saveKey:false,debugUrl:'http://127.0.0.1:8000',debugKey:''};
export function applyDefaultProfile(){
  if(read('defaultProfile',null)==='bailian-v1'){const old=read('settings',{});if(old.provider==='qwen'&&old.asrModel==='FunAudioLLM/SenseVoiceSmall')write('settings',{...old,asrModel:defaults.asrModel});return;}
  const previous=read('settings',{});
  write('settings',{...defaults,...previous,mode:defaults.mode,provider:defaults.provider,model:defaults.model,visionModel:defaults.visionModel,saveKey:false});
  localStorage.removeItem('silver.key');sessionStorage.removeItem('silver.key');
  write('defaultProfile','bailian-v1');
}
export function read(key,fallback){try{return JSON.parse(localStorage.getItem('silver.'+key))??fallback;}catch{return fallback;}}
export function write(key,value){localStorage.setItem('silver.'+key,JSON.stringify(value));}
export function localDay(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function dateTimeValue(d=new Date()){return `${localDay(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
export function reserveUsage(){const today=localDay(); const u=read('usage',{day:today,count:0});if(u.day!==today){u.day=today;u.count=0;}if(u.count>=30)throw new Error('今天已达到 30 次联网调用上限，继续使用离线功能。');u.count++;write('usage',u);return u.count;}
export const settings=()=>({...defaults,...read('settings',{})});
export function newId(){return Math.floor(Date.now()%1000000000 + Math.random()*1000000);}
export function nextOccurrence(m,now=new Date()) {const d=new Date(m.at);if(m.daily){d.setFullYear(now.getFullYear(),now.getMonth(),now.getDate());if(d<=now)d.setDate(d.getDate()+1);}return d;}
