export function chooseArrangement(metadata = {}, sourceText = "", preferredStyle = "auto") {
  const tempo = Number(metadata.tempo) || 80;
  const beat = String(metadata.beat || "4/4");
  const chordCount = (String(sourceText).match(/[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m)?\d*(?:[#b]?\d+)*/g) || []).length;
  const style = preferredStyle === "auto"
    ? (beat === "3/4" || beat === "6/8" ? "waltz" : tempo >= 105 ? "pop" : "ballad")
    : preferredStyle;
  const presets = {
    ballad: ["抒情分解", "右手以 1-3-5-3 分解和弦，左手根音與五度，保留歌聲空間。"],
    pop: ["流行律動", "右手以切分和弦音型帶動律動，左手以根音和五度穩定節拍。"],
    waltz: ["華爾滋", "第一拍放低音，後兩拍輕彈和弦，適合 3/4、6/8 與慢搖擺。"],
    jazz: ["爵士和聲", "保留七和弦與延伸音，右手以 3-7 為重心，左手根音導向。"]
  };
  const [label, summary] = presets[style] || presets.ballad;
  return {
    style: presets[style] ? style : "ballad",
    label,
    summary: `${summary}${chordCount ? ` 已辨識 ${chordCount} 個和弦。` : ""}`,
    source: "local"
  };
}
