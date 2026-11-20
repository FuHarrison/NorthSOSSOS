# ADR-0003：執行時零依賴，手寫 RFC 6455 WebSocket

- 狀態：已接受（2026-11-20 追認現況）
- 日期：2026-11-20
- 決策者：開發者
- 對應需求：CON-001、SYS-050、QS-020

## 背景
主機管理者可能是任何不懂程式的同事，拿到資料夾後只要安裝 Node.js、雙擊啟動檔就要能用。

## 考慮過的選項
1. **用 npm 套件**（例如 `ws`、`express`，Node 生態系的主流）：要 `npm install` 或附上 `node_modules`。
   - 切換代價：發佈資料夾要附 `node_modules` 或要求主機管理者執行 `npm install`；`server.js` 的轉發層改用套件 API，大約一兩天。
2. **只用 Node 內建模組**：HTTP 用 `http`，WebSocket 自己依 RFC 6455 實作文字訊框。
3. （其他平台）**打包成單一執行檔**（例如 Go 寫的 server，或 Node 的 single executable application）。
   - 切換代價：Go 要重寫整個 server 與世界模擬（ADR-0001 要用 JavaScript 執行遊戲程式，很難換）；Node 單一執行檔要另外建置，發佈流程變複雜。

## 決策
選項 2。

## 理由
- 不用 `npm install`，交付物就是幾個檔案（QS-020）。
- 需要的 WebSocket 功能很少（文字訊框、分段、ping/pong、close）。

## 後果
- 好處：安裝步驟最少；沒有套件版本與供應鏈問題。
- 代價：WebSocket 的邊界情況（壓縮、超大訊框、背壓）要自己處理；目前沒有限制訊息大小（已從 code 確認，R8）。
- 之後要注意：新功能不能引入執行時套件；開發工具可以例外（CON-002）。

## 重新檢視的條件
- 需要 HTTPS、網際網路連線或明顯多於 6 人的連線。
- 手寫 WebSocket 出現難以自行修正的相容問題（例如新版瀏覽器連不上）。
