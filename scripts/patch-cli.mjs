// Capacitor 6 的 CommonJS 编译代码按 tar 6 的 default 导出读取。
// 固定 tar 7 的安全修复版本，并对已知调用位置做可重复的兼容补丁。
import {readFile,writeFile} from 'node:fs/promises';
const path='node_modules/@capacitor/cli/dist/util/template.js';
const original='const tar_1 = tslib_1.__importDefault(require("tar"));';
const replacement='const tar_1 = { default: require("tar") };';
const source=await readFile(path,'utf8');
if(source.includes(original)){await writeFile(path,source.replace(original,replacement));console.log('Capacitor 6 / tar 7 兼容补丁已应用');}
else if(!source.includes(replacement))throw new Error('Capacitor CLI 模板代码变化，请检查 tar 兼容补丁。');
