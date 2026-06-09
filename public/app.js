const els = {};
const state = {
  imageDataUrl: "",
  score: null,
  previewMode: "both"
};

const DRAFT_KEY = "piano-number-score-translator:draft:v2";
const DEMO_SONG = {
  id: "7086",
  query: "永不失聯的愛",
  url: "https://www.91pu.com.tw/song/2017/0701/7086.html"
};

const NOTE_TO_SEMITONE = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  "B#": 0
};

const NATURAL_SCALE = [0, 2, 4, 5, 7, 9, 11];
const CHORD_SOURCE = String.raw`[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m)?\d*(?:[#b]?\d+)*(?:\/[A-G](?:#|b)?)?`;
const CHORD_SCAN = new RegExp(String.raw`(^|[^A-Za-z0-9#b/])(${CHORD_SOURCE})(?![A-Za-z])`, "g");

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  const restored = restoreDraft();
  if (!restored) renderEmpty();
  refreshIcons();
  runStartupActions();
});

function bindElements() {
  [
    "networkStatus",
    "apiHealth",
    "searchInput",
    "searchButton",
    "searchResults",
    "dropZone",
    "demoSongButton",
    "clearWorkspaceButton",
    "imageInput",
    "imagePreview",
    "ocrButton",
    "ocrStatus",
    "scoreStats",
    "titleInput",
    "artistInput",
    "lyricistInput",
    "composerInput",
    "originalKeyInput",
    "playKeyInput",
    "tempoInput",
    "beatInput",
    "sourceText",
    "parseButton",
    "previewGrid",
    "sheet-accompaniment",
    "sheet-chord",
    "showBothButton",
    "showAccompanimentButton",
    "showChordButton"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.searchButton.addEventListener("click", () => search91pu());
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") search91pu();
  });
  els.demoSongButton.addEventListener("click", loadDemoSong);
  els.clearWorkspaceButton.addEventListener("click", clearWorkspace);

  els.dropZone.addEventListener("click", () => els.imageInput.click());
  els.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") els.imageInput.click();
  });
  els.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
  els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("dragging"));
  els.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
    if (file) loadImageFile(file);
  });
  els.imageInput.addEventListener("change", () => {
    const file = els.imageInput.files?.[0];
    if (file) loadImageFile(file);
  });

  document.addEventListener("paste", (event) => {
    const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) loadImageFile(file);
  });

  document.querySelectorAll(".sample-button").forEach((button) => {
    button.addEventListener("click", () => loadSampleImage(button.dataset.sample));
  });

  els.ocrButton.addEventListener("click", runOcr);
  els.parseButton.addEventListener("click", parseAndRender);
  els.sourceText.addEventListener("input", debounce(parseAndRender, 300));
  els.sourceText.addEventListener("input", debounce(saveDraft, 500));

  [
    "titleInput",
    "artistInput",
    "lyricistInput",
    "composerInput",
    "originalKeyInput",
    "playKeyInput",
    "tempoInput",
    "beatInput"
  ].forEach((id) => {
    els[id].addEventListener("input", debounce(parseAndRender, 300));
    els[id].addEventListener("input", debounce(saveDraft, 500));
  });

  els.showBothButton.addEventListener("click", () => setPreviewMode("both"));
  els.showAccompanimentButton.addEventListener("click", () => setPreviewMode("accompaniment"));
  els.showChordButton.addEventListener("click", () => setPreviewMode("chord"));

  document.querySelectorAll("[data-download]").forEach((button) => {
    button.addEventListener("click", () => handleDownload(button.dataset.download));
  });

  checkApiHealth();
  window.setInterval(checkApiHealth, 60000);
}

async function checkApiHealth() {
  if (!els.apiHealth) return;

  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "API offline");

    const time = new Date(data.generatedAt || Date.now()).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    els.apiHealth.className = "api-health ok";
    els.apiHealth.innerHTML = `<i data-lucide="activity"></i><span>動態 API 已連線：${escapeHtml(data.mode || "server")} · ${time}</span>`;
  } catch {
    els.apiHealth.className = "api-health error";
    els.apiHealth.innerHTML = `<i data-lucide="circle-alert"></i><span>動態 API 無法連線，搜尋與匯入可能無法使用。</span>`;
  }

  refreshIcons();
}

function loadDemoSong() {
  els.searchInput.value = DEMO_SONG.query;
  importSong(DEMO_SONG.id, DEMO_SONG.url);
}

function clearWorkspace() {
  const hasWork = [
    "titleInput",
    "artistInput",
    "lyricistInput",
    "composerInput",
    "originalKeyInput",
    "playKeyInput",
    "tempoInput",
    "beatInput",
    "sourceText"
  ].some((id) => els[id].value.trim());

  if (hasWork && !window.confirm("確定要清空目前草稿？")) return;

  [
    "searchInput",
    "titleInput",
    "artistInput",
    "lyricistInput",
    "composerInput",
    "originalKeyInput",
    "playKeyInput",
    "tempoInput",
    "beatInput",
    "sourceText"
  ].forEach((id) => {
    els[id].value = "";
  });

  els.searchResults.innerHTML = "";
  els.ocrStatus.textContent = "";
  state.imageDataUrl = "";
  state.score = null;
  els.imagePreview.hidden = true;
  els.imagePreview.removeAttribute("src");
  const copy = els.dropZone.querySelector(".drop-copy");
  if (copy) copy.style.display = "";

  localStorage.removeItem(DRAFT_KEY);
  renderEmpty();
  setStatus("已清空");
}

async function search91pu(queryOverride) {
  const query = (queryOverride || els.searchInput.value || "").trim();
  if (!query) {
    setStatus("請輸入關鍵字", "warn");
    return;
  }

  setStatus("搜尋中");
  els.searchResults.innerHTML = "";

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=500`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "搜尋失敗");
    renderSearchResults(data);
    const suffix = data.complete ? "" : `，已列出前 ${data.fetched} 筆`;
    setStatus(`${data.total} 筆結果${suffix}`);
  } catch (error) {
    setStatus("搜尋失敗", "error");
    els.searchResults.innerHTML = `<p class="hint-line">${escapeHtml(error.message)}</p>`;
  }
}

function renderSearchResults(data) {
  const results = data.results || [];
  if (!results.length) {
    els.searchResults.innerHTML = `<p class="hint-line">沒有找到結果，可以換歌名、歌手或貼上 91pu 內容。</p>`;
    return;
  }

  els.searchResults.innerHTML = results.map((item) => `
    <div class="result-item">
      <div>
        <div class="result-title">${escapeHtml(item.title)}</div>
        <div class="result-meta">${escapeHtml([item.artist, item.lyricist, item.composer].filter(Boolean).join(" / "))}</div>
      </div>
      <button type="button" class="icon-button" data-import="${escapeHtml(item.id)}" data-url="${escapeHtml(item.url)}" title="匯入">
        <i data-lucide="download-cloud"></i><span>匯入</span>
      </button>
    </div>
  `).join("");

  els.searchResults.querySelectorAll("[data-import]").forEach((button) => {
    button.addEventListener("click", () => importSong(button.dataset.import, button.dataset.url));
  });
  refreshIcons();
}

async function importSong(id, sourceUrl = "") {
  setStatus("匯入中");
  try {
    const params = new URLSearchParams({ id });
    if (sourceUrl) params.set("url", sourceUrl);
    const response = await fetch(`/api/song?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "匯入失敗");

    els.titleInput.value = data.title || "";
    els.artistInput.value = data.artist || "";
    els.lyricistInput.value = data.lyricist || "";
    els.composerInput.value = data.composer || "";
    els.originalKeyInput.value = data.originalKey || "";
    els.playKeyInput.value = data.playKey || data.originalKey || "";
    els.tempoInput.value = data.tempo || "";
    els.beatInput.value = data.beat || "4/4";
    els.sourceText.value = data.sourceText || "";

    const brushText = formatBrush(data.brush);
    els.ocrStatus.textContent = brushText ? `已匯入。${brushText}` : "已匯入 91pu 歌曲資料。";
    parseAndRender();
    saveDraft();
    setStatus("已匯入");
  } catch (error) {
    setStatus("匯入失敗", "error");
    els.ocrStatus.textContent = error.message;
  }
}

function loadImageFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    setImagePreview(reader.result);
    els.ocrStatus.textContent = "圖片已載入。";
  };
  reader.readAsDataURL(file);
}

async function loadSampleImage(src) {
  const response = await fetch(src);
  const blob = await response.blob();
  const reader = new FileReader();
  reader.onload = () => {
    setImagePreview(reader.result);
    els.ocrStatus.textContent = "範例圖片已載入。";
  };
  reader.readAsDataURL(blob);
}

function setImagePreview(dataUrl) {
  state.imageDataUrl = dataUrl;
  els.imagePreview.src = dataUrl;
  els.imagePreview.hidden = false;
  const copy = els.dropZone.querySelector(".drop-copy");
  if (copy) copy.style.display = "none";
}

async function runOcr() {
  if (!state.imageDataUrl) {
    els.ocrStatus.textContent = "請先貼上或選取圖片。";
    return;
  }

  try {
    els.ocrStatus.textContent = "載入 OCR";
    await ensureScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", "Tesseract");

    els.ocrStatus.textContent = "辨識中";
    const result = await Tesseract.recognize(state.imageDataUrl, "chi_tra+eng", {
      logger: (message) => {
        if (message.status === "recognizing text") {
          els.ocrStatus.textContent = `辨識中 ${Math.round(message.progress * 100)}%`;
        }
      }
    });

    const text = normalizeSource(result.data.text || "");
    if (text) {
      els.sourceText.value = text;
      fillEmptyMetadata(inferMetadata(text));
      parseAndRender();
      saveDraft();
    }

    const query = inferSearchQuery(text);
    if (query) {
      els.searchInput.value = query;
      els.ocrStatus.textContent = `已辨識：${query}`;
      await search91pu(query);
    } else {
      els.ocrStatus.textContent = "已辨識圖片，未找到明確歌名。";
    }
  } catch (error) {
    els.ocrStatus.textContent = `OCR 失敗：${error.message}`;
  }
}

function parseAndRender() {
  const source = els.sourceText.value.trim();
  const metadata = readMetadata();
  const inferred = inferMetadata(source);
  const score = buildScore({ ...inferred, ...removeEmpty(metadata) }, source);

  state.score = score;
  renderScore(score);
  saveDraft();
}

function readMetadata() {
  return {
    title: els.titleInput.value.trim(),
    artist: els.artistInput.value.trim(),
    lyricist: els.lyricistInput.value.trim(),
    composer: els.composerInput.value.trim(),
    originalKey: els.originalKeyInput.value.trim(),
    playKey: els.playKeyInput.value.trim(),
    tempo: els.tempoInput.value.trim(),
    beat: els.beatInput.value.trim()
  };
}

function saveDraft() {
  try {
    const payload = {
      metadata: readMetadata(),
      sourceText: els.sourceText.value,
      previewMode: state.previewMode,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Local storage can be unavailable in private windows.
  }
}

function restoreDraft() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("autoload") || params.get("q")) return false;

  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    const metadata = draft.metadata || {};

    els.titleInput.value = metadata.title || "";
    els.artistInput.value = metadata.artist || "";
    els.lyricistInput.value = metadata.lyricist || "";
    els.composerInput.value = metadata.composer || "";
    els.originalKeyInput.value = metadata.originalKey || "";
    els.playKeyInput.value = metadata.playKey || "";
    els.tempoInput.value = metadata.tempo || "";
    els.beatInput.value = metadata.beat || "";
    els.sourceText.value = draft.sourceText || "";

    if (["both", "accompaniment", "chord"].includes(draft.previewMode)) {
      setPreviewMode(draft.previewMode);
    }

    if (els.sourceText.value.trim() || els.titleInput.value.trim()) {
      parseAndRender();
      setStatus("已恢復草稿");
      return true;
    }
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }

  return false;
}

function fillEmptyMetadata(metadata) {
  const pairs = {
    titleInput: metadata.title,
    artistInput: metadata.artist,
    lyricistInput: metadata.lyricist,
    composerInput: metadata.composer,
    originalKeyInput: metadata.originalKey,
    playKeyInput: metadata.playKey,
    tempoInput: metadata.tempo,
    beatInput: metadata.beat
  };

  Object.entries(pairs).forEach(([id, value]) => {
    if (value && !els[id].value.trim()) els[id].value = value;
  });
}

function inferMetadata(source) {
  const lines = normalizeSource(source).split("\n").map((line) => line.trim()).filter(Boolean);
  const joined = lines.slice(0, 14).join(" | ");
  const titleLine = lines.find((line) => {
    const plain = line.replace(/\[[^\]]+\]/g, "").replace(/^91pu\.com\.tw/i, "").trim();
    return plain.length >= 2
      && plain.length <= 26
      && /[\u4e00-\u9fff]/.test(plain)
      && !findChordTokens(plain).length
      && !/(演唱|歌手|詞|曲|原調|男調|女調|速度|拍號|參考|91pu|Page)/i.test(plain);
  });

  return removeEmpty({
    title: titleLine,
    artist: matchMeta(joined, /(?:演唱|歌手)[:：\s]*([^|]+)/),
    lyricist: matchMeta(joined, /(?:作詞|詞)[:：\s]*([^|]+)/),
    composer: matchMeta(joined, /(?:作曲|曲)[:：\s]*([^|]+)/),
    originalKey: matchMeta(joined, /原調[:：\s]*([A-G](?:#|b)?m?)/i),
    playKey: matchMeta(joined, /(?:伴奏選調|選調|曲調|Key)[:：\s]*(?:1\s*=\s*)?([A-G](?:#|b)?m?)/i),
    tempo: matchMeta(joined, /(?:速度|Tempo)[:：\s]*(?:[=♩♪]?\s*)?(\d+)/i),
    beat: matchMeta(joined, /(?:拍號|拍數)[:：\s]*([0-9]+\/[0-9]+)/)
  });
}

function buildScore(metadata, source) {
  const clean = normalizeSource(source);
  const sections = parseSections(clean);

  return {
    metadata: {
      title: metadata.title || "未命名歌曲",
      artist: metadata.artist || "",
      lyricist: metadata.lyricist || "",
      composer: metadata.composer || "",
      originalKey: metadata.originalKey || "",
      playKey: metadata.playKey || metadata.originalKey || "",
      tempo: metadata.tempo || "",
      beat: metadata.beat || "4/4"
    },
    sections: sections.length ? sections : [makeFallbackSection()]
  };
}

function parseSections(source) {
  const lines = source.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim());
  const sections = [];
  let current = null;
  let pendingRow = null;

  const ensureSection = (name = "主歌") => {
    if (!current || current.name !== name) {
      current = { name, rows: [] };
      sections.push(current);
      pendingRow = null;
    }
    return current;
  };

  for (const rawLine of lines) {
    let line = normalizeBarLine(rawLine);
    const section = extractSection(line);

    if (section) {
      ensureSection(section.name);
      line = section.rest;
      if (!line) continue;
    } else if (!current) {
      ensureSection("主歌");
    }

    if (isMetaLine(line)) continue;

    if (isChordLine(line)) {
      const measures = extractChordMeasures(line).map((chord) => makeMeasure(chord, []));
      if (!measures.length) continue;
      chunk(measures, 4).forEach((measureChunk) => {
        const row = { measures: measureChunk };
        current.rows.push(row);
        pendingRow = row;
      });
      continue;
    }

    if (!line.trim() || shouldSkipTextLine(line)) continue;
    if (!pendingRow) {
      pendingRow = { measures: [makeMeasure("", [line.trim()])] };
      current.rows.push(pendingRow);
      continue;
    }

    distributeLyrics(line, pendingRow.measures);
  }

  return sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) => row.measures.some((measure) => measure.chord || measure.lyrics.length))
    }))
    .filter((section) => section.rows.length);
}

function extractSection(line) {
  const match = line.match(/^\s*[\[【]([^\]】]+)[\]】]\s*(.*)$/);
  if (!match) return null;
  return {
    name: match[1].trim(),
    rest: match[2].trim()
  };
}

function normalizeBarLine(line) {
  return String(line || "")
    .replace(/[｜︱∣]/g, "|")
    .replace(/\s+\|/g, " |")
    .replace(/\|\s+/g, "|")
    .trim();
}

function isChordLine(line) {
  if (!line) return false;
  if (isMetaLine(line)) return false;
  const chords = findChordTokens(line);
  if (!chords.length) return false;
  if (line.includes("|")) return true;
  const stripped = line.replace(new RegExp(CHORD_SOURCE, "g"), "").replace(/[\s.,;:()\[\]{}\-_/|▲△●○]+/g, "");
  return stripped.length <= 2;
}

function extractChordMeasures(line) {
  const withoutSection = line.replace(/^\s*[\[【][^\]】]+[\]】]\s*/, "").trim();
  if (withoutSection.includes("|")) {
    return withoutSection
      .split("|")
      .map((part) => findChordTokens(part).join("  "))
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return findChordTokens(withoutSection);
}

function findChordTokens(text) {
  const output = [];
  const source = String(text || "");
  const re = new RegExp(CHORD_SCAN.source, "g");
  let match = re.exec(source);
  while (match) {
    output.push(match[2]);
    match = re.exec(source);
  }
  return output;
}

function makeMeasure(chord, lyrics) {
  const harmony = chordLabelToNumbers(chord);
  return {
    chord: chord || "",
    lyrics: lyrics || [],
    pattern: harmony.pattern,
    right: harmony.right,
    left: harmony.left
  };
}

function distributeLyrics(line, measures) {
  const text = line.replace(/^歌詞\s*[:：]?/, "").trim();
  const parts = splitLyricParts(text, measures.length);
  parts.forEach((part, index) => {
    if (part && measures[index]) measures[index].lyrics.push(part);
  });
}

function splitLyricParts(line, count) {
  const bySpaces = line.split(/\s{2,}|\t+/).map((item) => item.trim()).filter(Boolean);
  if (bySpaces.length === 2 && count >= 4) return [bySpaces[0], "", bySpaces[1], ""];
  if (bySpaces.length > 1) return fitParts(bySpaces, count);

  if (line.length <= Math.max(10, count * 8)) return [line];
  const size = Math.ceil(line.length / count);
  const parts = [];
  for (let index = 0; index < count; index += 1) {
    const part = line.slice(index * size, (index + 1) * size).trim();
    if (part) parts.push(part);
  }
  return fitParts(parts, count);
}

function fitParts(parts, count) {
  const output = Array(count).fill("");
  parts.slice(0, count).forEach((part, index) => {
    output[index] = part;
  });
  if (parts.length > count) {
    output[count - 1] = parts.slice(count - 1).join(" ");
  }
  return output;
}

function isMetaLine(line) {
  return /(演唱|歌手|作詞|作曲|原調|男調|女調|速度|拍號|參考刷法|參考指法|Capo|Page\s+\d+)/i.test(line)
    && !line.includes("|");
}

function shouldSkipTextLine(line) {
  return /^(C\/Am|G\/Em|調前奏六線譜|參考刷法|參考指法|91pu\.com\.tw)/i.test(line.trim());
}

function chordLabelToNumbers(chordLabel) {
  const tokens = findChordTokens(chordLabel);
  if (!tokens.length) return { pattern: "", right: "", left: "" };

  const parts = tokens.map((token) => chordToDegrees(token));
  return {
    pattern: parts.map((part) => part.pattern).join("   "),
    right: parts.map((part) => part.right).join(" / "),
    left: parts.map((part) => part.left).join(" / ")
  };
}

function chordToDegrees(chordLabel) {
  const parsed = parseChord(chordLabel);
  if (!parsed) {
    return { pattern: "1 3 5 3", right: "1 3 5 -", left: "1. - 5. -" };
  }

  const intervals = chordIntervals(parsed.quality);
  const numbers = intervals.map((interval) => semitoneToFixedNumber(parsed.rootSemitone + interval));
  const bass = parsed.bass ? semitoneToFixedNumber(NOTE_TO_SEMITONE[parsed.bass], true) : `${numbers[0] || "1"}.`;
  const root = numbers[0] || "1";
  const third = numbers[1] || root;
  const fifth = numbers[2] || root;
  const seventh = numbers[3] || "-";

  return {
    pattern: [third, root, third, fifth, seventh === "-" ? root : seventh, third].join(" "),
    right: [root, third, fifth, seventh].join(" "),
    left: [bass, "-", `${fifth}.`, "-"].join(" ")
  };
}

function parseChord(chord) {
  const match = String(chord || "").match(/^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/);
  if (!match) return null;
  const root = match[1];
  return {
    root,
    rootSemitone: NOTE_TO_SEMITONE[root],
    quality: match[2] || "",
    bass: match[3] || ""
  };
}

function chordIntervals(quality) {
  const q = String(quality || "").toLowerCase();
  if (q.includes("sus2")) return [0, 2, 7, q.includes("7") ? 10 : null].filter((item) => item !== null);
  if (q.includes("sus4") || q.includes("sus")) return [0, 5, 7, q.includes("7") ? 10 : null].filter((item) => item !== null);
  if (q.includes("dim")) return [0, 3, 6, q.includes("7") ? 9 : null].filter((item) => item !== null);
  if (q.includes("aug")) return [0, 4, 8, q.includes("7") ? 10 : null].filter((item) => item !== null);
  if (/m(?!aj)/.test(q) || q.includes("min")) return [0, 3, 7, q.includes("7") ? 10 : null].filter((item) => item !== null);
  if (q.includes("maj7")) return [0, 4, 7, 11];
  if (q.includes("7")) return [0, 4, 7, 10];
  return [0, 4, 7];
}

function semitoneToFixedNumber(semitone, lower = false) {
  const normalized = mod(semitone, 12);
  const exactIndex = NATURAL_SCALE.indexOf(normalized);
  if (exactIndex !== -1) return `${exactIndex + 1}${lower ? "." : ""}`;

  for (let index = 0; index < NATURAL_SCALE.length; index += 1) {
    const degree = index + 1;
    if (mod(NATURAL_SCALE[index] + 1, 12) === normalized) return `#${degree}${lower ? "." : ""}`;
    if (mod(NATURAL_SCALE[index] - 1, 12) === normalized) return `b${degree}${lower ? "." : ""}`;
  }
  return lower ? "?." : "?";
}

function renderScore(score) {
  els["sheet-accompaniment"].innerHTML = renderAccompanimentSheet(score);
  els["sheet-chord"].innerHTML = renderChordSheet(score);
  document.body.dataset.rendered = "true";
  updateScoreStats(score);
  refreshIcons();
}

function renderAccompanimentSheet(score) {
  return `
    ${renderHeader(score, "鋼琴伴奏簡譜（手稿音型修正版）")}
    ${score.sections.map((section) => `
      <section class="score-section">
        <h3 class="section-title">[${escapeHtml(section.name)}]</h3>
        ${section.rows.map((row) => renderAccompanimentRow(row)).join("")}
      </section>
    `).join("")}
    <div class="sheet-footer">依 91pu 和弦自動轉換為鋼琴伴奏音型，請依實際旋律微調。</div>
  `;
}

function renderChordSheet(score) {
  return `
    ${renderHeader(score, "鋼琴和弦簡譜（專業精緻一頁版）")}
    ${score.sections.map((section) => `
      <section class="score-section">
        <h3 class="section-title">[${escapeHtml(section.name)}]</h3>
        ${section.rows.map((row) => renderChordRow(row)).join("")}
      </section>
    `).join("")}
    <div class="sheet-footer">右手為和弦音，左手為低音與五度；長譜下載 PDF 時會自動分頁。</div>
  `;
}

function renderHeader(score, subtitle) {
  const meta = score.metadata;
  const metaItems = [
    ["演唱", meta.artist || "-"],
    ["詞", meta.lyricist || "-"],
    ["曲", meta.composer || "-"],
    ["原調", meta.originalKey || "-"],
    ["伴奏選調", meta.playKey || "-"],
    ["速度", meta.tempo || "-"],
    ["拍號", meta.beat || "-"]
  ];

  return `
    <header class="score-header">
      <h2>${escapeHtml(meta.title)}</h2>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
      <div class="meta-line">
        ${metaItems.map(([label, value]) => `<span><strong>${label}：</strong>${escapeHtml(value)}</span>`).join("")}
      </div>
    </header>
  `;
}

function renderAccompanimentRow(row) {
  return `
    <div class="measure-grid">
      ${padMeasures(row.measures).map((measure, index) => `
        <div class="measure ${index === 3 ? "end-bar" : ""}">
          <div class="chord-name">${escapeHtml(measure.chord || " ")}</div>
          <div class="number-line">${escapeHtml(measure.pattern || " ")}</div>
          ${renderLyrics(measure.lyrics)}
        </div>
      `).join("")}
    </div>
  `;
}

function renderChordRow(row) {
  return `
    <div class="measure-grid">
      ${padMeasures(row.measures).map((measure, index) => `
        <div class="measure ${index === 3 ? "end-bar" : ""}">
          <div class="chord-name">${escapeHtml(measure.chord || " ")}</div>
          <div class="hand-line"><em>右</em>${escapeHtml(measure.right || " ")}</div>
          <div class="hand-line"><em>左</em>${escapeHtml(measure.left || " ")}</div>
          ${renderLyrics(measure.lyrics)}
        </div>
      `).join("")}
    </div>
  `;
}

function renderLyrics(lyrics) {
  if (!lyrics?.length) return "";
  return `<div class="lyric-lines">${lyrics.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>`;
}

function renderEmpty() {
  const empty = `
    <div class="empty-state">
      <div>
        <strong>搜尋、貼圖或貼上和弦後即可轉譜</strong>
        <span>輸出會顯示在這裡，並可下載 JPG 或 PDF。</span>
      </div>
    </div>
  `;
  els["sheet-accompaniment"].innerHTML = empty;
  els["sheet-chord"].innerHTML = empty;
  document.body.dataset.rendered = "false";
  updateScoreStats(null);
}

function updateScoreStats(score) {
  if (!els.scoreStats) return;

  if (!score) {
    els.scoreStats.innerHTML = `
      <ul class="check-list">
        <li class="warn"><i data-lucide="circle-alert"></i><span>尚未產生譜面。請搜尋匯入、貼圖辨識，或貼上 91pu 和弦文字。</span></li>
      </ul>
    `;
    refreshIcons();
    return;
  }

  const rows = score.sections.flatMap((section) => section.rows);
  const measures = rows.flatMap((row) => row.measures).filter((measure) => measure.chord || measure.lyrics.length);
  const chordNames = new Set(
    measures
      .flatMap((measure) => findChordTokens(measure.chord))
      .filter(Boolean)
  );
  const lyricLines = measures.reduce((sum, measure) => sum + (measure.lyrics?.length || 0), 0);
  const meta = score.metadata;
  const checks = [
    meta.title && meta.title !== "未命名歌曲" ? ["ok", "歌名已填入"] : ["warn", "建議補上歌名"],
    meta.playKey || meta.originalKey ? ["ok", "調性資料可用"] : ["warn", "建議補上原調或選調"],
    chordNames.size ? ["ok", `已解析 ${chordNames.size} 個和弦`] : ["warn", "沒有解析到和弦"],
    lyricLines ? ["ok", `已對齊 ${lyricLines} 行歌詞`] : ["warn", "沒有歌詞，將只輸出和弦音型"]
  ];

  els.scoreStats.innerHTML = `
    <div class="stat-grid">
      <div class="stat-item"><strong>${score.sections.length}</strong><span>段落</span></div>
      <div class="stat-item"><strong>${measures.length}</strong><span>小節</span></div>
      <div class="stat-item"><strong>${chordNames.size}</strong><span>和弦</span></div>
    </div>
    <ul class="check-list">
      ${checks.map(([type, text]) => `
        <li class="${type}">
          <i data-lucide="${type === "ok" ? "circle-check" : "circle-alert"}"></i>
          <span>${escapeHtml(text)}</span>
        </li>
      `).join("")}
    </ul>
  `;
  refreshIcons();
}

function runStartupActions() {
  const params = new URLSearchParams(window.location.search);
  const autoload = params.get("autoload");
  const query = params.get("q");
  if (query) {
    els.searchInput.value = query;
    search91pu(query);
  }
  if (autoload) importSong(autoload);
}

function setPreviewMode(mode) {
  state.previewMode = mode;
  els.previewGrid.className = `preview-grid show-${mode}`;
  els.showBothButton.classList.toggle("active", mode === "both");
  els.showAccompanimentButton.classList.toggle("active", mode === "accompaniment");
  els.showChordButton.classList.toggle("active", mode === "chord");
}

async function handleDownload(action) {
  if (!state.score) {
    setStatus("尚未轉譜", "warn");
    return;
  }

  const [target, format] = action.split("-");
  const title = safeFileName(state.score.metadata.title || "score");

  try {
    setStatus("產生檔案");
    if (action === "both-pdf") {
      await downloadBothPdf(`${title}-鋼琴雙模簡譜.pdf`);
    } else {
      const element = target === "chord" ? els["sheet-chord"] : els["sheet-accompaniment"];
      const suffix = target === "chord" ? "鋼琴和弦簡譜" : "鋼琴伴奏簡譜";
      if (format === "jpg") await downloadJpg(element, `${title}-${suffix}.jpg`);
      if (format === "pdf") await downloadPdf(element, `${title}-${suffix}.pdf`);
    }
    setStatus("已下載");
  } catch (error) {
    setStatus("下載失敗", "error");
    els.ocrStatus.textContent = error.message;
  }
}

async function downloadJpg(element, filename) {
  const canvas = await renderElementCanvas(element);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
  triggerDownload(URL.createObjectURL(blob), filename);
}

async function downloadPdf(element, filename) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const canvas = await renderElementCanvas(element);
  addCanvasPagesToPdf(pdf, canvas);
  pdf.save(filename);
}

async function downloadBothPdf(filename) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const first = await renderElementCanvas(els["sheet-accompaniment"]);
  addCanvasPagesToPdf(pdf, first);
  const second = await renderElementCanvas(els["sheet-chord"]);
  addCanvasPagesToPdf(pdf, second, true);
  pdf.save(filename);
}

async function renderElementCanvas(element) {
  if (!window.html2canvas) throw new Error("html2canvas 尚未載入。");
  return html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: Math.max(document.documentElement.clientWidth, 1200)
  });
}

function addCanvasPagesToPdf(pdf, canvas, forceNewPage = false) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const sliceHeight = Math.floor(canvas.width * (pageHeight / pageWidth));
  const scale = pageWidth / canvas.width;
  let y = 0;
  let pageIndex = 0;

  while (y < canvas.height) {
    if (forceNewPage || pageIndex > 0) pdf.addPage();
    forceNewPage = false;

    const currentSliceHeight = Math.min(sliceHeight, canvas.height - y);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = currentSliceHeight;
    const ctx = pageCanvas.getContext("2d");
    ctx.drawImage(canvas, 0, y, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);

    const imageHeight = currentSliceHeight * scale;
    pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageWidth, imageHeight);
    y += currentSliceHeight;
    pageIndex += 1;
  }
}

function triggerDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeSource(source) {
  return String(source || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[｜︱∣]/g, "|")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inferSearchQuery(text) {
  const lines = normalizeSource(text).split("\n").map((line) => line.trim()).filter(Boolean);
  const preferred = lines.find((line) => /91pu\.com\.tw/i.test(line))
    ? ""
    : lines.find((line) => {
      const clean = line.replace(/Page\s+\d+.*$/gi, "").trim();
      return clean.length >= 2
        && clean.length <= 26
        && /[\u4e00-\u9fff]/.test(clean)
        && !findChordTokens(clean).length
        && !/(演唱|歌手|詞|曲|原調|男調|女調|速度|拍號|參考|前奏|主歌|副歌|尾奏|間奏|91pu)/i.test(clean);
    });

  if (preferred) return preferred.replace(/[^\u4e00-\u9fffA-Za-z0-9\s]/g, "").trim();

  const titleFromMeta = matchMeta(lines.slice(0, 16).join(" | "), /(?:歌名|曲名|標題)[:：\s]*([^|]+)/);
  return titleFromMeta.replace(/[^\u4e00-\u9fffA-Za-z0-9\s]/g, "").trim();
}

function makeFallbackSection() {
  return {
    name: "範例",
    rows: [
      {
        measures: ["C", "G", "Am", "F"].map((chord) => makeMeasure(chord, []))
      }
    ]
  };
}

function padMeasures(measures) {
  const output = measures.slice(0, 4);
  while (output.length < 4) output.push({ chord: "", lyrics: [], pattern: "", right: "", left: "" });
  return output;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function matchMeta(text, regex) {
  return String(text || "").match(regex)?.[1]?.trim() || "";
}

function removeEmpty(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function formatBrush(brush) {
  if (!brush) return "";
  const parts = [];
  if (brush.sft) parts.push(`刷法 ${brush.sft}`);
  if (brush.zft) parts.push(`指法 ${brush.zft}`);
  return parts.join("；");
}

function setStatus(text, type = "normal") {
  els.networkStatus.textContent = text;
  els.networkStatus.style.background = type === "error" ? "#fee4e2" : type === "warn" ? "#fff4d6" : "#e5f6f3";
  els.networkStatus.style.color = type === "error" ? "#b42318" : type === "warn" ? "#8a5a00" : "#11634f";
}

function ensureScript(src, globalName) {
  if (window[globalName]) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("OCR 程式載入失敗。"));
    document.head.appendChild(script);
  });
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function debounce(fn, delay) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function safeFileName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) || "score";
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
