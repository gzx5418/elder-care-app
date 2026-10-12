import { searchLifeAnswer, assessFraud, assessHealth } from '../src/engines.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {kind,text}=JSON.parse(input);
const methods={life:searchLifeAnswer,fraud:assessFraud,health:assessHealth};
if(!methods[kind]||typeof text!=='string'||text.length>2000)process.exit(1);
process.stdout.write(JSON.stringify(methods[kind](text)));
