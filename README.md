# 91吉他譜 ➜ 鋼琴雙模簡譜智能轉換器

這是一個本機與 Netlify 都可部署的 Web 工具，可搜尋 91pu 吉他譜，或貼上/辨識圖片內容，轉成兩種 A4 輸出：

- 鋼琴伴奏簡譜
- 鋼琴和弦簡譜

輸出的譜面可下載 JPG、單頁/多頁 PDF，或合併成雙頁 PDF。

## 功能

- 91pu 全站搜尋歌曲、歌手、作詞、作曲。
- 匯入 91pu 歌曲資料與和弦歌詞。
- 動態 API：`/api/search`、`/api/song`、`/api/health`。
- 圖片拖放、貼上、OCR 辨識。
- 自動保存草稿，重新整理後可繼續編修。
- 轉譜檢查：段落、小節、和弦數、歌詞對齊與缺漏資料提示。
- Netlify Functions 代理 `/api/search`、`/api/song`，部署後仍可搜尋與匯入。

## 本機使用

```powershell
npm start
```

開啟：

```text
http://localhost:5173/
```

## 檢查

```powershell
npm.cmd run check
```

## Netlify

Netlify 設定在 `netlify.toml`：

- 靜態檔發布目錄：`public`
- Functions 目錄：`netlify/functions`

目前線上站台：

```text
https://piano-number-score-translator.netlify.app/
```
