package com.elderhelper.app;

import android.Manifest;
import android.media.MediaRecorder;
import android.media.MediaPlayer;
import android.util.Base64;
import java.io.File;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;
import java.util.TimeZone;

@CapacitorPlugin(name = "ElderNative", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
    @Permission(alias = "calendar", strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR })
})
public class ElderNativePlugin extends Plugin {
    private TextToSpeech tts;
    private MediaRecorder recorder;
    private File recordingFile;
    private MediaPlayer player;
    private PluginCall playbackCall;
    private boolean ttsReady = false;

    @Override public void load() {
        getActivity().runOnUiThread(() -> {
            tts = new TextToSpeech(getContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    int language = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
                    ttsReady = language != TextToSpeech.LANG_MISSING_DATA && language != TextToSpeech.LANG_NOT_SUPPORTED;
                    tts.setSpeechRate(0.85f);
                }
            });
        });
    }

    @PluginMethod public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text.length() > 10000) text = text.substring(0,10000);
        if (!ttsReady) { call.reject("手机尚无可用的中文朗读引擎，请在系统设置中安装或开启中文语音。"); return; }
        final String spoken = text;
        getActivity().runOnUiThread(() -> {
            int result = tts.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, "silver-speech");
            if (result == TextToSpeech.ERROR) call.reject("朗读暂时不可用。"); else call.resolve();
        });
    }

    @PluginMethod public void stopSpeaking(PluginCall call) {
        getActivity().runOnUiThread(() -> { if(tts!=null)tts.stop(); if(player!=null){player.release();player=null;}if(playbackCall!=null){playbackCall.resolve();playbackCall=null;}call.resolve(); });
    }
    @PluginMethod public void playAudio(PluginCall call) {
        String url=call.getString("url", "");
        Uri uri=Uri.parse(url);
        if(!"https".equals(uri.getScheme())||uri.getHost()==null||!uri.getHost().endsWith(".aliyuncs.com")){call.reject("语音地址无效。");return;}
        getActivity().runOnUiThread(() -> {
            try {if(player!=null)player.release();if(playbackCall!=null)playbackCall.resolve();playbackCall=call;player=new MediaPlayer();player.setDataSource(url);
                player.setOnPreparedListener(p->p.start());
                player.setOnErrorListener((p,w,e)->{p.release();if(player==p)player=null;if(playbackCall==call)playbackCall=null;call.reject("语音播放失败，请重试。");return true;});
                player.setOnCompletionListener(p->{p.release();if(player==p)player=null;if(playbackCall==call)playbackCall=null;call.resolve();});player.prepareAsync();
            }catch(Exception ignored){call.reject("语音播放失败，请重试。");}
        });
    }
    @PluginMethod public void startRecording(PluginCall call) {
        if(getPermissionState("microphone")!=PermissionState.GRANTED){requestPermissionForAlias("microphone",call,"recordPermission");return;} beginRecording(call);
    }
    @PermissionCallback private void recordPermission(PluginCall call){
        if(getPermissionState("microphone")==PermissionState.GRANTED)beginRecording(call);else call.reject("请允许麦克风权限，或使用文字输入。");
    }
    private void beginRecording(PluginCall call){
        if(recorder!=null){call.reject("请先结束当前录音。");return;}
        try {recordingFile=File.createTempFile("silver-voice-", ".aac",getContext().getCacheDir());
            recorder=new MediaRecorder();recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS);recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(16000);recorder.setAudioEncodingBitRate(64000);recorder.setOutputFile(recordingFile.getAbsolutePath());recorder.prepare();recorder.start();call.resolve();
        }catch(Exception ignored){releaseRecording();call.reject("无法开始录音，请检查麦克风权限后重试。");}
    }
    private void releaseRecording(){if(recorder!=null){try{recorder.stop();}catch(Exception ignored){}recorder.release();recorder=null;}if(recordingFile!=null){recordingFile.delete();recordingFile=null;}}
    @PluginMethod public void recordingLevel(PluginCall call){
        try{JSObject result=new JSObject();result.put("level",recorder==null?0:recorder.getMaxAmplitude()/32768.0);call.resolve(result);}
        catch(Exception ignored){call.reject("麦克风检测失败。");}
    }
    @PluginMethod public void cancelRecording(PluginCall call){releaseRecording();call.resolve();}
    @PluginMethod public void stopRecording(PluginCall call){
        try {if(recorder==null){call.reject("没有正在进行的录音。");return;}recorder.stop();recorder.release();recorder=null;
            if(recordingFile.length()>10*1024*1024)throw new Exception();
            byte[] data;try(FileInputStream in=new FileInputStream(recordingFile);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);data=out.toByteArray();}
            JSObject result=new JSObject();result.put("data",Base64.encodeToString(data,Base64.NO_WRAP));result.put("mimeType","audio/aac");call.resolve(result);
        }catch(Exception ignored){call.reject("没有录到声音，请再试一次。");}finally{releaseRecording();}
    }

    private void launch(PluginCall call, Intent intent) {
        try { getActivity().startActivity(intent); call.resolve(); }
        catch (Exception ignored) { call.reject("手机没有可处理此操作的系统应用。"); }
    }

    @PluginMethod public void dial(PluginCall call) {
        String number = call.getString("number", "");
        if (!number.matches("[+0-9 -]{3,20}")) { call.reject("电话号码不正确。"); return; }
        launch(call, new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(number))));
    }

    @PluginMethod public void sms(PluginCall call) {
        String number = call.getString("number", "");
        if (!number.matches("[+0-9 -]{3,20}")) { call.reject("请先保存家属电话。"); return; }
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number)));
        intent.putExtra("sms_body", call.getString("text", ""));
        launch(call, intent);
    }

    @PluginMethod public void copy(PluginCall call) {
        ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(android.content.Context.CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newPlainText("银龄助手", call.getString("text", "")));
        call.resolve();
    }

    @PluginMethod public void notificationSettings(PluginCall call) {
        Intent intent;
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        launch(call,intent);
    }

    @PluginMethod public void microphone(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) requestPermissionForAlias("microphone",call,"microphoneResult");
        else call.resolve();
    }
    @PermissionCallback private void microphoneResult(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) call.resolve();
        else call.reject("麦克风权限未开启，您仍可使用文字输入。");
    }

    @PluginMethod public void listen(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "慢慢说，我在听");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        try { startActivityForResult(call,intent,"speechResult"); }
        catch (Exception ignored) { call.reject("未找到语音识别服务，请在手机设置中启用，或手动输入。"); }
    }
    @ActivityCallback private void speechResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) { call.reject("语音输入已取消，您可以手动输入。"); return; }
        ArrayList<String> texts = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (texts == null || texts.isEmpty()) { call.reject("没有听清，请再说一次。"); return; }
        JSObject ret = new JSObject(); ret.put("text", texts.get(0)); call.resolve(ret);
    }

    @PluginMethod public void calendar(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED){if(Boolean.FALSE.equals(call.getBoolean("requestPermission",true)))call.reject("日历权限未开启。");else requestPermissionForAlias("calendar",call,"calendarResult");}
        else insertCalendar(call);
    }
    @PermissionCallback private void calendarResult(PluginCall call) {
        if (getPermissionState("calendar") == PermissionState.GRANTED) insertCalendar(call);
        else call.reject("日历权限未开启，原有本地提醒仍然保留。");
    }
    private void insertCalendar(PluginCall call) {
        long start = call.getLong("start",0L);
        if(start <= 0) { call.reject("提醒时间不正确。"); return; }
        try {
            String account = "silver-helper-local";
            long calendarId = -1;
            try (Cursor cursor = getContext().getContentResolver().query(CalendarContract.Calendars.CONTENT_URI,
                new String[]{CalendarContract.Calendars._ID}, CalendarContract.Calendars.ACCOUNT_NAME + "=? AND " + CalendarContract.Calendars.ACCOUNT_TYPE + "=?",new String[]{account,CalendarContract.ACCOUNT_TYPE_LOCAL},null)) {
                if(cursor != null && cursor.moveToFirst()) calendarId = cursor.getLong(0);
            }
            if(calendarId < 0) {
                ContentValues c = new ContentValues();
                c.put(CalendarContract.Calendars.ACCOUNT_NAME,account);
                c.put(CalendarContract.Calendars.ACCOUNT_TYPE,CalendarContract.ACCOUNT_TYPE_LOCAL);
                c.put(CalendarContract.Calendars.NAME,"银龄助手提醒");
                c.put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,"银龄助手提醒");
                c.put(CalendarContract.Calendars.CALENDAR_COLOR,0xFFE8742A);
                c.put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,CalendarContract.Calendars.CAL_ACCESS_OWNER);
                c.put(CalendarContract.Calendars.OWNER_ACCOUNT,account);
                c.put(CalendarContract.Calendars.CALENDAR_TIME_ZONE,TimeZone.getDefault().getID());
                c.put(CalendarContract.Calendars.VISIBLE,1); c.put(CalendarContract.Calendars.SYNC_EVENTS,1);
                Uri syncUri = CalendarContract.Calendars.CONTENT_URI.buildUpon().appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER,"true")
                    .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME,account).appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE,CalendarContract.ACCOUNT_TYPE_LOCAL).build();
                Uri result = getContext().getContentResolver().insert(syncUri,c);
                if(result == null) { call.reject("无法创建本地日历。"); return; }
                calendarId = Long.parseLong(result.getLastPathSegment());
            }
            String reminderId=call.getString("reminderId","");
            long existingId=-1;
            if(!reminderId.isEmpty()){
                try(Cursor cursor=getContext().getContentResolver().query(CalendarContract.Events.CONTENT_URI,new String[]{CalendarContract.Events._ID},CalendarContract.Events.CALENDAR_ID+"=? AND "+CalendarContract.Events.DESCRIPTION+" LIKE ? AND "+CalendarContract.Events.DELETED+"=0",new String[]{String.valueOf(calendarId),"%[silver-memo:"+reminderId+"]"},null)){
                    if(cursor!=null&&cursor.moveToFirst())existingId=cursor.getLong(0);
                }
            }
            if(existingId<0&&call.getLong("eventId",0L)>0){
                long candidate=call.getLong("eventId",0L);
                try(Cursor cursor=getContext().getContentResolver().query(CalendarContract.Events.CONTENT_URI,new String[]{CalendarContract.Events._ID},CalendarContract.Events._ID+"=? AND "+CalendarContract.Events.CALENDAR_ID+"=? AND "+CalendarContract.Events.DELETED+"=0",new String[]{String.valueOf(candidate),String.valueOf(calendarId)},null)){
                    if(cursor!=null&&cursor.moveToFirst())existingId=candidate;
                }
            }
            ContentValues e = new ContentValues();
            e.put(CalendarContract.Events.CALENDAR_ID,calendarId); e.put(CalendarContract.Events.TITLE,call.getString("title","银龄助手提醒"));
            e.put(CalendarContract.Events.DESCRIPTION,call.getString("description","")+(reminderId.isEmpty()?"":"\n[silver-memo:"+reminderId+"]")); e.put(CalendarContract.Events.DTSTART,start);
            e.put(CalendarContract.Events.EVENT_TIMEZONE,TimeZone.getDefault().getID()); e.put(CalendarContract.Events.HAS_ALARM,1);
            if(Boolean.TRUE.equals(call.getBoolean("daily",false))) { e.put(CalendarContract.Events.RRULE,"FREQ=DAILY");e.put(CalendarContract.Events.DURATION,"PT15M");e.putNull(CalendarContract.Events.DTEND); }
            else {e.put(CalendarContract.Events.DTEND,start+15*60000L);e.putNull(CalendarContract.Events.RRULE);e.putNull(CalendarContract.Events.DURATION);}
            Uri event;
            if(existingId>=0){event=android.content.ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,existingId);getContext().getContentResolver().update(event,e,null,null);}
            else event=getContext().getContentResolver().insert(CalendarContract.Events.CONTENT_URI,e);
            if(event == null) {call.reject("日历没有保存成功。");return;}
            long eventId = Long.parseLong(event.getLastPathSegment());
            getContext().getContentResolver().delete(CalendarContract.Reminders.CONTENT_URI,CalendarContract.Reminders.EVENT_ID+"=?",new String[]{String.valueOf(eventId)});
            ContentValues reminder = new ContentValues(); reminder.put(CalendarContract.Reminders.EVENT_ID,eventId);
            reminder.put(CalendarContract.Reminders.MINUTES,call.getInt("minutes",15)); reminder.put(CalendarContract.Reminders.METHOD,CalendarContract.Reminders.METHOD_ALERT);
            getContext().getContentResolver().insert(CalendarContract.Reminders.CONTENT_URI,reminder);
            JSObject response=new JSObject();response.put("eventId",eventId);call.resolve(response);
        } catch(Exception ignored) { call.reject("手机日历不支持此操作，原有本地提醒仍然保留。"); }
    }

    @PluginMethod public void deleteCalendar(PluginCall call){
        if(getPermissionState("calendar")!=PermissionState.GRANTED){call.reject("日历权限未开启，请在系统日历中删除提醒。");return;}
        long id=call.getLong("eventId",0L);if(id<=0){call.resolve();return;}
        try{
            long calendarId=-1;
            try(Cursor cursor=getContext().getContentResolver().query(CalendarContract.Events.CONTENT_URI,new String[]{CalendarContract.Events.CALENDAR_ID},CalendarContract.Events._ID+"=?",new String[]{String.valueOf(id)},null)){if(cursor!=null&&cursor.moveToFirst())calendarId=cursor.getLong(0);}
            boolean owned=false;
            try(Cursor cursor=getContext().getContentResolver().query(CalendarContract.Calendars.CONTENT_URI,new String[]{CalendarContract.Calendars._ID},CalendarContract.Calendars._ID+"=? AND "+CalendarContract.Calendars.ACCOUNT_NAME+"=? AND "+CalendarContract.Calendars.ACCOUNT_TYPE+"=?",new String[]{String.valueOf(calendarId),"silver-helper-local",CalendarContract.ACCOUNT_TYPE_LOCAL},null)){owned=cursor!=null&&cursor.moveToFirst();}
            if(owned)getContext().getContentResolver().delete(android.content.ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,id),null,null);
            call.resolve();
        }catch(Exception ignored){call.reject("日历删除失败，请检查系统日历。");}
    }

    @Override protected void handleOnDestroy() {
        releaseRecording();if(player!=null){player.release();player=null;}
        if(tts != null) { tts.stop();tts.shutdown(); }
    }
}
