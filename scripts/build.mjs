import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { metadata,life,health,emergencies,fraudRules } from '../src/data.js';
await mkdir('frontend', { recursive: true });
let key=process.env.BAILIAN_API_KEY||'';
if(process.env.BUILD_WITHOUT_PRIVATE_KEY!=='1'&&!key){try{key=JSON.parse(await readFile('.local/bailian.json','utf8')).apiKey||'';}catch(error){if(error.code!=='ENOENT')throw new Error('本机百炼配置无法读取，请检查 JSON。');}}
if(process.env.BUILD_WITHOUT_PRIVATE_KEY==='1')key='';
await build({ entryPoints: ['src/app.js'], bundle: true, outfile: 'frontend/app.js', format: 'iife', target: ['chrome89'], minify: true,define:{__BUNDLED_BAILIAN_KEY__:JSON.stringify(key)} });
await Promise.all(['index.html','app.css','logo.svg'].map(f => copyFile(`src/${f}`, `frontend/${f}`)));
await mkdir('frontend/data', {recursive:true});
await Promise.all(Object.entries({life_knowledge:{...metadata,items:life},health_knowledge:{...metadata,items:health,emergencies},fraud_rules:{...metadata,rules:fraudRules}}).map(([name,data])=>writeFile(`frontend/data/${name}.json`,JSON.stringify(data,null,2))));
console.log('Web 资源已构建到 frontend/');
