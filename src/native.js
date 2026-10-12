import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';
import { desensitizeText } from './engines.js';
import { synthesize } from './ai.js';
import { nextOccurrence } from './store.js';
export const native=Capacitor.isNativePlatform();
export const Elder=registerPlugin('ElderNative');
let speechTicket=0, audio=null;
export async function stopSpeaking(){speechTicket++;if(audio){audio.pause();audio=null;}window.speechSynthesis?.cancel();if(native)await Elder.stopSpeaking();}
export async function speak(text,{localOnly=false}={}){
  await stopSpeaking();const ticket=speechTicket;
  if(native){try{await Elder.speak({text});return;}catch{}}
  else if(window.speechSynthesis?.getVoices().some(v=>v.lang.startsWith('zh'))){const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=0.85;speechSynthesis.speak(u);return;}
  if(localOnly)throw new Error("手机中文朗读不可用，请先处理紧急情况。");
  text=desensitizeText(text);
  for(let start=0;start<text.length;start+=500){
    if(ticket!==speechTicket)return;const url=await synthesize(text.slice(start,start+500));if(ticket!==speechTicket)return;
    if(native)await Elder.playAudio({url});
    else {audio=new Audio(url);const playing=audio;await new Promise((resolve,reject)=>{playing.onended=resolve;playing.onerror=()=>reject(new Error('语音播放失败，请重试。'));playing.onpause=resolve;playing.play().catch(reject);});}
  }
}
export async function shareText(text){if(native){await Share.share({title:'银龄助手',text,dialogTitle:'分享给家人'});return;}if(navigator.share){await navigator.share({text});return;}await copyText(text);}
export async function copyText(text){if(native){await Elder.copy({text});return;}await navigator.clipboard.writeText(text);}
export async function dial(number){if(!/^[\d+ -]{3,20}$/.test(number))throw new Error('请先填写正确的联系电话。');if(native)await Elder.dial({number});else location.href='tel:'+number;}
export async function sms(number,text){if(!number)throw new Error('请先在家属联系中保存电话号码。');if(native){await Elder.sms({number,text});return;}location.href=`sms:${encodeURIComponent(number)}?body=${encodeURIComponent(text)}`;}
export async function notificationStatus(){if(!native)return {display:'web',exact:false};const p=await LocalNotifications.checkPermissions();let exact=true;if(Capacitor.getPlatform()==='android'){const e=await LocalNotifications.checkExactNotificationSetting();exact=e.exact_alarm==='granted';}return {display:p.display,exact};}
export async function requestNotifications(){if(!native)return notificationStatus();await LocalNotifications.requestPermissions();return notificationStatus();}
export async function scheduleMemo(m,{snooze=false}={}){
  if(!native)return {display:'web'};
  const status=await notificationStatus();if(status.display!=='granted')return status;
  await LocalNotifications.createChannel({id:'silver-reminders',name:'通用生活提醒',description:'银龄助手的重要生活提醒',importance:5,visibility:1,vibration:true});
  const at=snooze?new Date(m.snoozedUntil||Date.now()+10*60000):nextOccurrence(m);
  if(at<=new Date())return status;
  const id=snooze?m.id+1100000000:m.id;
  await LocalNotifications.cancel({notifications:[{id}]});
  const schedule=!snooze&&m.daily?{on:{hour:at.getHours(),minute:at.getMinutes()},repeats:true,allowWhileIdle:true}:{at,allowWhileIdle:true};
  await LocalNotifications.schedule({notifications:[{id,title:m.type==='吃药'?'该吃药了':'您的生活提醒',body:`${m.title}${m.dose?' · '+m.dose:''}`,schedule,channelId:'silver-reminders',actionTypeId:'silver-memo',extra:{memoId:m.id},autoCancel:true}]});
  return status;
}
export async function cancelMemo(id){if(native){await LocalNotifications.cancel({notifications:[{id},{id:id+1100000000}]});await LocalNotifications.removeDeliveredNotifications({notifications:[{id},{id:id+1100000000}]});}}
export async function syncCalendar(m,{requestPermission=true}={}){if(!native)throw new Error('同步日历需在安卓 App 中使用。');return Elder.calendar({requestPermission,reminderId:String(m.id),eventId:m.calendarEventId||0,title:m.title,description:m.dose||m.type,start:nextOccurrence(m).getTime(),daily:m.daily,minutes:0});}
export async function initializeNative(onMemoAction,onResume,onBack){
  if(!native)return;
  await LocalNotifications.registerActionTypes({types:[{id:'silver-memo',actions:[{id:'done',title:'已完成',foreground:true},{id:'later',title:'10 分钟后提醒',foreground:true}]}]});
  await LocalNotifications.addListener('localNotificationActionPerformed',event=>onMemoAction(event.actionId,event.notification.extra?.memoId));
  await App.addListener('appStateChange',state=>{if(state.isActive)onResume();});
  await App.addListener('backButton',()=>onBack());
}
