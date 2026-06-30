# 91吉他譜 ➜ 雙手/單手鋼琴伴奏轉譜器

這是一個本機、Vercel、Netlify 都可部署的 Web 轉譜器，可搜尋 91pu 吉他譜，或貼上/辨識圖片內容，轉成兩種 A4 輸出：

- 雙手鋼琴伴奏譜：右手和弦音、左手低音與五度。
- 單手鋼琴伴奏譜：右手伴奏音型，適合快速彈唱與初學。

相同和弦進行會自動合併，不同段歌詞疊成編號歌詞行。每一種譜固定輸出一張 A4 JPG 或單頁 PDF，也可合併成兩頁的雙譜 PDF。

## 功能

- 91pu 全站搜尋歌曲、歌手、作詞、作曲。
- 匯入 91pu 歌曲資料與和弦歌詞。
- 動態 API：`/api/search`、`/api/song`、`/api/health`。
- 遠端連線面板：手機掃 QR、電腦複製網址、網頁顯示 API 連線模式。
- PWA 支援：手機與桌面可安裝到裝置，並快取應用外殼。
- 圖片拖放、貼上、OCR 辨識。
- 同類段落會逐列比對和弦；即使主歌前後略有差異，重複伴奏仍會合併並保留所有編號歌詞。
- 單手、雙手譜各自固定為一張 A4，長內容自動切換緊密、密集或單頁版面後再等比例輸出。
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
3. 點「轉譜」產生雙手鋼琴伴奏譜與單手鋼琴伴奏譜。
4. 點「雙譜 PDF」下載，或在「更多格式」下載單手/雙手 JPG、PDF。

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
