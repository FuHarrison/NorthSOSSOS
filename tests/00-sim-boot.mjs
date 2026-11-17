// server 上的世界能不能正常跑起來：起 server，等 4 秒，看有沒有錯誤訊息
import {buildTestCopy,startServer,sleep,HERE} from './lib/harness.mjs';
import fs from 'node:fs';
const dir=HERE+'/t-sim';fs.rmSync(dir,{recursive:true,force:true});buildTestCopy(dir);
const sv=await startServer(dir,18190);await sleep(4000);sv.close();
const bad=/錯|失敗|Error|找不到/.test(sv.out);console.log(bad?'FAIL sim':'PASS sim 正常運作');if(bad){console.log(sv.out);process.exitCode=1}
