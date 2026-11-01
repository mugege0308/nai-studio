/* Shared category normalization for dictionary results and character actions. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NaiTagSearchCategory = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const labels = Object.freeze({0: "一般", 1: "絵師", 3: "作品", 4: "キャラ", 5: "メタ"});
  const localLabels = Object.freeze({
    all: "すべて", face: "表情・顔", hair: "髪", clothes: "衣装", pose: "動作・ポーズ",
    camera: "構図", scene: "背景", light: "光・雰囲気", details: "小物・特徴"
  });
  const aliases = Object.freeze({
    general: 0, generaltag: 0, common: 0, 一般: 0,
    artist: 1, author: 1, creator: 1, 絵師: 1, 作者: 1,
    copyright: 3, work: 3, works: 3, series: 3, 作品: 3, 作品名: 3,
    character: 4, characters: 4, char: 4, charactertag: 4, charactername: 4,
    キャラ: 4, キャラクター: 4,
    meta: 5, metadata: 5, metatag: 5, メタ: 5
  });

  function key(value) {
    return String(value ?? "").trim().toLowerCase().normalize("NFKC").replace(/[\s_-]+/g, "");
  }

  function normalize(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && Number.isInteger(value)) return value;
    const raw = String(value).trim();
    if (/^\d+$/.test(raw)) return Number(raw);
    const normalized = key(raw);
    return Object.prototype.hasOwnProperty.call(aliases, normalized) ? aliases[normalized] : null;
  }

  function canonical(value) {
    const id = normalize(value);
    if (id !== null) return id;
    return String(value ?? "").trim().toLowerCase() || "";
  }

  function label(value) {
    const id = normalize(value);
    if (id !== null && Object.prototype.hasOwnProperty.call(labels, id)) return labels[id];
    return localLabels[key(value)] || "タグ";
  }

  function isCharacter(value) {
    return normalize(value) === 4;
  }

  return {normalize, canonical, label, isCharacter, labels, localLabels};
});
