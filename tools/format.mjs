// 排版：用 Prettier 把 js/、css/、server.js、tests/、tools/ 排成一般寬度（設定在 .prettierrc.json）
//   node tools/format.mjs          直接改檔案
//   node tools/format.mjs --check  只檢查，有沒排好的就列出來並回傳錯誤
// 專案不放 npm 依賴：Prettier 先找 node_modules，再找 VS Code 的 Prettier 擴充套件內建的那份。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  check = process.argv.includes('--check');
async function loadPrettier() {
  try {
    return await import(pathToFileURL(createRequire(path.join(ROOT, 'x.js')).resolve('prettier')).href);
  } catch (e) {}
  for (const base of [
    path.join(os.homedir(), '.vscode', 'extensions'),
    path.join(os.homedir(), '.cursor', 'extensions')
  ]) {
    let dirs = [];
    try {
      dirs = fs
        .readdirSync(base)
        .filter(d => d.startsWith('esbenp.prettier-vscode-'))
        .sort()
        .reverse();
    } catch (e) {}
    for (const d of dirs) {
      const p = path.join(base, d, 'node_modules', 'prettier', 'index.mjs');
      if (fs.existsSync(p)) return await import(pathToFileURL(p).href);
    }
  }
  console.error('找不到 Prettier。裝 VS Code 的 Prettier 擴充套件，或在專案資料夾執行一次：npm i --no-save prettier');
  process.exit(2);
}

const prettier = await loadPrettier(),
  opts = JSON.parse(fs.readFileSync(path.join(ROOT, '.prettierrc.json'), 'utf8'));
const list = [];
for (const d of ['js', 'css', 'tests', 'tests/lib', 'tools'])
  for (const f of fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)) : [])
    if (/\.(js|mjs|css)$/.test(f)) list.push(path.join(d, f));
list.push('server.js');
let bad = 0;
for (const f of list) {
  const p = path.join(ROOT, f),
    src = fs.readFileSync(p, 'utf8'),
    out = await prettier.format(src, { ...opts, filepath: p });
  if (out === src) continue;
  if (check) {
    console.log('沒排好：' + f);
    bad++;
  } else {
    fs.writeFileSync(p, out);
    console.log('排好了：' + f);
  }
}
console.log(
  check
    ? bad
      ? `${bad} 個檔案沒排好，執行 node tools/format.mjs`
      : '全部都排好了'
    : `檢查了 ${list.length} 個檔案（Prettier ${prettier.version}）`
);
process.exitCode = bad ? 1 : 0;
