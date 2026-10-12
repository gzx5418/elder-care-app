import os
os.environ['DEBUG_API_KEY']='test-only-key'
from fastapi.testclient import TestClient
import main
client=TestClient(main.app)
headers={'X-Api-Key':'test-only-key'}

def setup_function():
    main.recent.clear();main.reminders.clear()

def test_authentication():
    assert client.post('/api/life',json={'text':'话费'}).status_code==401
    assert client.get('/reminders').status_code==401

def test_life():
    r=client.post('/api/life',headers=headers,json={'text':'怎么交话费'})
    assert r.status_code==200
    assert r.json()['result']['id']=='phone'

def test_fraud():
    r=client.post('/api/fraud',headers=headers,json={'text':'请转到安全账户'})
    assert r.json()['result']['level']=='high'

def test_emergency():
    r=client.post('/api/health',headers=headers,json={'text':'家人胸痛'})
    assert r.json()['result']['emergency'] is True

def test_input_limit():
    assert client.post('/api/life',headers=headers,json={'text':'字'*2001}).status_code==422

def test_rate_limit():
    for _ in range(10):assert client.get('/reminders',headers=headers).status_code==200
    assert client.get('/reminders',headers=headers).status_code==429

def test_uuid_crud():
    r=client.post('/reminders',headers=headers,json={'title':'吃药','at':'2026-10-10T08:00'})
    assert r.status_code==200
    assert client.delete('/reminders/'+r.json()['id'],headers=headers).status_code==200
    assert client.get('/reminders',headers=headers).json()==[]

def test_headers():
    r=client.get('/healthz')
    assert r.headers['x-content-type-options']=='nosniff'
    assert r.headers['x-frame-options']=='DENY'

def test_cors():
    r=client.options('/api/life',headers={'Origin':'https://untrusted.example','Access-Control-Request-Method':'POST'})
    assert 'access-control-allow-origin' not in r.headers

def test_trusted_host():
    assert client.get('/healthz',headers={'Host':'untrusted.example'}).status_code==400
