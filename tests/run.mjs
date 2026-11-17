// 跑全部測試：node tests/run.mjs        只跑部分：node tests/run.mjs bag admin（檔名包含這些字的）
// 每個測試檔各自開無頭 Chrome（或 Edge），單人用 file:// 開遊戲副本，多人另外起一個測試用 server（埠 18190 以上）。
// 需要 Node 22 以上，以及 Chrome 或 Edge；不需要 npm install。截圖和暫存存檔在 tests/.tmp。
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DIR=path.dirname(fileURLToPath(import.meta.url)),want=process.argv.slice(2);
const files=fs.readdirSync(DIR).filter(f=>/^\d\d-.+\.mjs$/.test(f)&&(!want.length||want.some(w=>f.includes(w)))).sort();
let pass=0,fail=0;const bad=[];const t0=Date.now();
for(const f of files){
  const out=await new Promise(res=>{const p=spawn(process.execPath,[path.join(DIR,f)],{stdio:['ignore','pipe','pipe']});let o='';
    p.stdout.on('data',d=>o+=d);p.stderr.on('data',d=>o+=d);const kill=setTimeout(()=>{o+='\nTIMEOUT（超過 5 分鐘）';p.kill()},300000);p.on('close',c=>{clearTimeout(kill);res({o,c})})});
  const p=(out.o.match(/^PASS /gm)||[]).length,fl=(out.o.match(/^FAIL .*/gm)||[]),crash=out.c!==0&&!fl.length;
  pass+=p;fail+=fl.length+(crash?1:0);
  console.log(`${fl.length||crash?'✗':'✓'} ${f.padEnd(36)} ${p} 項通過${fl.length?`，${fl.length} 項失敗`:''}${crash?'，中途出錯':''}`);
  for(const l of fl)console.log('    '+l);
  if(crash){bad.push(f);console.log(out.o.split('\n').filter(l=>/Error|TIMEOUT|at /.test(l)).slice(0,6).map(l=>'    '+l).join('\n'))}
  else if(fl.length)bad.push(f)}
console.log(`\n${files.length} 個測試檔，${pass} 項通過，${fail} 項失敗（${Math.round((Date.now()-t0)/1000)} 秒）`);
process.exitCode=fail?1:0;
