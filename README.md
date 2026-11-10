# 橘貓站長的九九快打

一款適合 PC 與 iPad 橫向操作的九九乘法反應遊戲。遊戲採純 HTML、CSS、JavaScript 製作，不需要伺服器、資料庫或建置工具，可直接部署到 GitHub Pages。

## 遊戲內容

- 九個漸進式關卡，依序練習 2～9 的乘法及混合題。
- 每局 80 秒，答對 10 題過關。
- 3×3、共九個洞口；關卡越後面，同時出現的橘貓越多、停留時間越短。
- 敲錯答案扣一顆愛心，一局最多五顆愛心。
- 答案消失不扣血，同一題會重新排列。
- 失敗後顯示結果，四秒後自動返回主地圖。
- 成功後依剩餘時間與愛心取得一至三顆星，並解鎖下一站。
- 第一次開始會由橘貓站長說明規則。
- 支援滑鼠、觸控與鍵盤數字鍵 1～9。
- 進度、星星及音效設定儲存在瀏覽器 `localStorage`。

## 本機預覽

在本資料夾開啟終端機後執行：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

接著開啟：

```text
http://127.0.0.1:4173/
```

直接雙擊 `index.html` 通常也能遊玩，但使用本機伺服器較接近 GitHub Pages 的實際環境。

## GitHub Pages 部署

1. 建立新的 GitHub repository。
2. 將本資料夾內的 `index.html`、`styles.css`、`game.js`、`assets` 與 `.nojekyll` 上傳到 repository 根目錄。
3. 到 GitHub repository 的 `Settings → Pages`。
4. 在 `Build and deployment` 選擇 `Deploy from a branch`。
5. 選擇主要分支及 `/ (root)` 後儲存。

本專案全部使用相對路徑，因此可部署在 `https://使用者名稱.github.io/儲存庫名稱/` 子路徑下。

## 主要檔案

- `index.html`：頁面結構、教學與各種對話框。
- `styles.css`：B版視覺、響應式配置、角色與槌擊動畫。
- `game.js`：題目、關卡、倒數、愛心、星等、音效與本機紀錄。
- `assets/`：橘貓站長、玩具槌、關卡背景與九站地圖。
- `ASSET_SOURCES.md`：素材來源與製作紀錄。
- `tmp/qa/smoke-report.json`：最後一次自動化瀏覽器測試結果。

## 已驗證環境

- 桌機 Chrome：1440×900。
- iPad 橫向模擬：1024×768。
- 驗證項目包含首次教學、九關地圖、九洞口、答對加分、答錯扣血、暫停倒數及頁面溢位。

