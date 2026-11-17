// 發佈：把 北境求生.html 和它載入的 css/、js/ 合成一個檔案，連同主機需要的檔案放進 dist/
//   node tools/build.mjs
// dist/北境求生.html 單獨傳給別人就能玩單人；整個 dist/ 資料夾就是一份完整的遊戲（server.js 也認得單一檔案的版本）。
// 不需要 npm install。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  OUT = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let html = read('北境求生.html');

// <link rel="stylesheet" href="css/…"> → <style>…</style>
html = html.replace(
  /<link rel="stylesheet" href="(css\/[\w.-]+\.css)">/g,
  (_, f) => `<style>\n${read(f).trimEnd()}\n</style>`
);
// 連續的 <script src="js/…"></script> → 一個 <script>（照原本順序接起來，跟分開載入時一樣共用頂層宣告）
const files = [...html.matchAll(/<script src="(js\/[\w.-]+\.js)"><\/script>/g)].map(m => m[1]);
if (!files.length) throw new Error('北境求生.html 裡找不到 <script src="js/…">');
// 程式裡的 </script 會提早結束 <script>，換成 <\/script（在字串裡意思一樣）
const code = files
  .map(f => `// ===== ${f} =====\n${read(f).trimEnd()}`)
  .join('\n\n')
  .replace(/<\/script/gi, '<\\/script');
let first = true;
html = html.replace(/<script src="js\/[\w.-]+\.js"><\/script>\n?/g, () => {
  if (!first) return '';
  first = false;
  return `<script>\n${code}\n</script>\n`;
});

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, '北境求生.html'), html);
for (const f of ['server.js', 'admin.html', '開主機.bat', 'README.md'])
  fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
const kb = n => Math.round(n / 1024) + ' KB';
console.log(`dist/北境求生.html：${files.length} 個 js 檔合成一個（${kb(Buffer.byteLength(html))}）`);
console.log('dist/ 另外放了 server.js、admin.html、開主機.bat、README.md，整個資料夾就能當主機。');
