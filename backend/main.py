"""仅开发调试；复用同一 JS 引擎，避免前后端规则漂移。普通 APK 不依赖此服务。"""
import json
import os
import secrets
import shutil
import subprocess
import time
from collections import defaultdict, deque
from pathlib import Path
from threading import Lock
from uuid import UUID, uuid4
from fastapi import FastAPI, Depends, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field

ROOT=Path(__file__).resolve().parents[1]
PROD=os.environ.get('ENV','dev')=='prod'
API_KEY=os.environ.get('DEBUG_API_KEY','')
app=FastAPI(title='银龄助手 · 本地调试',docs_url=None if PROD else '/docs',redoc_url=None if PROD else '/redoc',openapi_url=None if PROD else '/openapi.json')
app.add_middleware(TrustedHostMiddleware,allowed_hosts=['localhost','127.0.0.1','10.0.2.2','testserver'])
app.add_middleware(CORSMiddleware,allow_origins=['http://127.0.0.1:8080','http://localhost:8080','https://localhost'],allow_credentials=False,allow_methods=['GET','POST','DELETE'],allow_headers=['Content-Type','X-Api-Key'])
recent=defaultdict(deque)
reminders={}
lock=Lock()

@app.middleware('http')
async def safety_headers(request:Request,call_next):
    if request.headers.get('content-length','0').isdigit() and int(request.headers.get('content-length','0'))>16000:
        from starlette.responses import JSONResponse
        return JSONResponse({'message':'请求太大'},status_code=413)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Referrer-Policy']='no-referrer'
    response.headers['Content-Security-Policy']="default-src 'none'; frame-ancestors 'none'"
    return response

@app.exception_handler(Exception)
async def error_handler(request:Request,error:Exception):
    from starlette.responses import JSONResponse
    return JSONResponse({'message':'服务暂时不可用，请使用离线功能。'},status_code=500)

def auth(request:Request,x_api_key:str=Header(default='')):
    if not API_KEY or not secrets.compare_digest(x_api_key,API_KEY):raise HTTPException(401,'需要有效的调试密钥')
    now=time.monotonic();ip=request.client.host if request.client else 'unknown'
    with lock:
        # 回收历史 IP，防止限流记录不断增长。
        for key in list(recent):
            while recent[key] and recent[key][0]<now-60:recent[key].popleft()
            if not recent[key]:del recent[key]
        queue=recent[ip]
        if len(queue)>=10:raise HTTPException(429,'调用太频繁，请稍后重试')
        queue.append(now)

class Question(BaseModel):
    text:str=Field(min_length=1,max_length=2000)
class Reminder(BaseModel):
    title:str=Field(min_length=1,max_length=80)
    at:str=Field(min_length=1,max_length=40)
    daily:bool=False

def run_engine(kind,text):
    node=os.environ.get('NODE_BINARY') or shutil.which('node')
    if not node:raise HTTPException(503,'调试服务需要安装 Node.js')
    try:
        result=subprocess.run([node,str(ROOT/'scripts/engine-runner.mjs')],input=json.dumps({'kind':kind,'text':text}),capture_output=True,text=True,encoding='utf-8',timeout=5,cwd=ROOT,check=True)
        return json.loads(result.stdout)
    except (subprocess.SubprocessError,ValueError):raise HTTPException(503,'调试引擎暂不可用')

@app.get('/healthz')
def healthz():return {'status':'ok'}

@app.post('/api/{kind}',dependencies=[Depends(auth)])
def question(kind:str,q:Question):
    if kind not in ('life','health','fraud'):raise HTTPException(404,'接口不存在')
    result=run_engine(kind,q.text)
    explanation='；'.join([result.get('title',''),result.get('intro',''),*result.get('reasons',[]),*result.get('steps',[])])
    return {'result':result,'explanation':explanation,'mode':'local-debug'}

@app.get('/reminders',dependencies=[Depends(auth)])
def list_reminders():
    with lock:return list(reminders.values())

@app.post('/reminders',dependencies=[Depends(auth)])
def add_reminder(data:Reminder):
    with lock:
        if len(reminders)>=500:raise HTTPException(409,'调试提醒数量已达上限')
        item={'id':str(uuid4()),**data.model_dump()};reminders[item['id']]=item;return item

@app.delete('/reminders/{reminder_id}',dependencies=[Depends(auth)])
def delete_reminder(reminder_id:UUID):
    with lock:
        if reminders.pop(str(reminder_id),None) is None:raise HTTPException(404,'提醒不存在')
    return {'deleted':True}
