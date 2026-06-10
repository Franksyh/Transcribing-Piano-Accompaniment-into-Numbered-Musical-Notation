# 91吉他譜 ➜ 鋼琴雙模簡譜智能轉換器

這是一個本機、Vercel、Netlify 都可部署的 Web 轉譜器，可搜尋 91pu 吉他譜，或貼上/辨識圖片內容，轉成兩種 A4 輸出：

- 鋼琴伴奏簡譜
- 鋼琴和弦簡譜

輸出的譜面可下載 JPG、單頁/多頁 PDF，或合併成雙頁 PDF。

## 功能

- 91pu 全站搜尋歌曲、歌手、作詞、作曲。
- 匯入 91pu 歌曲資料與和弦歌詞。
- 動態 API：`/api/search`、`/api/song`、`/api/health`。
- 遠端連線面板：手機掃 QR、電腦複製網址、網頁顯示 API 連線模式。
- PWA 支援：手機與桌面可安裝到裝置，並快取應用外殼。
- 圖片拖放、貼上、OCR 辨識。
- 自動保存草稿，重新整理後可繼續編修。
- 轉譜檢查：段落、小節、和弦數、歌詞對齊與缺漏資料提示。
- 多人連線房間：手機、電腦、網頁可用同一房號同步譜面內容。
- Vercel Functions 與 Netlify Functions 都支援 `/api/search`、`/api/song`、`/api/health`。

## 線上使用

正式站台：

```text
https://transcribing-piano-accompaniment-no.vercel.app/
```

基本流程：

1. 在「輸入歌曲」搜尋歌名或歌手，點「匯入」。
2. 或直接把 91pu 和弦/歌詞貼到「和弦/歌詞」欄位。
3. 點「轉譜」產生鋼琴伴奏簡譜與鋼琴和弦簡譜。
4. 點「雙頁 PDF」下載，或在「更多格式」下載 JPG/單頁 PDF。

手機、電腦、網頁多人連線：

1. 展開「遠端與多人」。
2. 點「建立房間」。
3. 複製邀請連結給其他使用者，或讓手機掃 QR。
4. 其他使用者加入後，歌名、調性、和弦文字與預覽模式會同步。

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

## Vercel

Vercel 設定：

- 靜態檔目錄：`public`
- Functions 目錄：`api`
- 主要設定：`vercel.json`

## Netlify

Netlify 設定在 `netlify.toml`：

- 靜態檔發布目錄：`public`
- Functions 目錄：`netlify/functions`
