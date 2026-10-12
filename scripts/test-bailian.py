"""只向阿里云百炼官方 endpoint 测试，不输出密钥或请求头。"""
import json,time
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'.local/bailian.json').read_text(encoding='utf-8'))
key=config['apiKey'];base=config['baseUrl']
assert base=='https://dashscope.aliyuncs.com/compatible-mode/v1'
headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'}
models=['qwen-flash','qwen-plus','qwen3.8-flash','qwen3.7-plus']
results=[]
for model in models:
    start=time.perf_counter()
    try:
        r=requests.post(base+'/chat/completions',headers=headers,json={'model':model,'enable_thinking':False,'temperature':0.2,'max_tokens':260,'messages':[{'role':'system','content':'你是银龄助手，用老人能看懂的中文回答，最多120字。反诈不降低本地高危，健康不诊断或建议药物剂量。'},{'role':'user','content':'老人收到要求把钱转到安全账户的短信，本地已判高危。请给出简明的下一步建议。'}]},timeout=(10,35))
        try:data=r.json()
        except ValueError:data={}
        error=data.get('error',{})
        row={'model':model,'status':r.status_code,'seconds':round(time.perf_counter()-start,2),'errorCode':error.get('code'),'message':str(error.get('message','')).replace(key,'[已隐藏]')[:250]}
        if r.ok:
            row['answer']=data.get('choices',[{}])[0].get('message',{}).get('content','')
            row['usage']=data.get('usage',{})
        results.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
        if r.status_code==401:break
    except requests.RequestException:
        row={'model':model,'status':'network_error','seconds':round(time.perf_counter()-start,2)};results.append(row);print(json.dumps(row),flush=True)
(ROOT/'test-results').mkdir(exist_ok=True)
(ROOT/'test-results/bailian-probe.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
