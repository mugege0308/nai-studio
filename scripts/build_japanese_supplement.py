#!/usr/bin/env python3
"""Build a conservative Japanese translation supplement for general/meta tags.

The upstream shards remain untouched.  Only high-confidence, compositional
tags are added here; names, works, artists, ambiguous phrases and sensitive
terms are intentionally left in English.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TAGDB = ROOT / "data" / "tagdb"
OUTPUT = TAGDB / "translations-ja.json"


EXACT = {
    "animal ear hairband": "動物耳のヘアバンド",
    "animal ear headband": "動物耳のヘッドバンド",
    "animal ear hood": "動物耳のフード",
    "animal ear footwear": "動物耳の靴",
    "arm around another's waist": "相手の腰に腕を回す",
    "art program in frame": "画面内の作画ソフト",
    "art tools in frame": "画面内の画材",
    "beard stubble": "無精ひげ",
    "blunt sidelocks": "切りそろえた横髪",
    "braided base": "編み込みの土台",
    "braided twintails": "編み込みツインテール",
    "chain headband": "チェーン付きヘアバンド",
    "colored inner animal ears": "内側が色付きの動物耳",
    "colored speech bubble": "色付きの吹き出し",
    "contrast collar": "配色の異なる襟",
    "cow print gloves": "牛柄の手袋",
    "cross-laced shoes": "クロス編み上げ靴",
    "diagonal-striped clothes": "斜めストライプの服",
    "disposable coffee cup": "使い捨てコーヒーカップ",
    "flower hairclip": "花のヘアクリップ",
    "floral print kimono": "花柄の着物",
    "full cleavage": "胸元が大きく開いた服",
    "gold armlet": "金色の腕輪",
    "gold crown": "金色の王冠",
    "gold ring": "金色の指輪",
    "gold tiara": "金色のティアラ",
    "hands in own hair": "自分の髪に手を入れる",
    "halo behind head": "頭の後ろの光輪",
    "holding guitar": "ギターを持つ",
    "holding popsicle": "アイスキャンディーを持つ",
    "holding popsicle": "アイスキャンディーを持つ",
    "holding unworn hat": "かぶっていない帽子を持つ",
    "jewel under eye": "目の下の宝石",
    "loose hair strand": "ほつれ毛",
    "low-tied sidelocks": "低い位置で結んだ横髪",
    "multiple hairclips": "複数のヘアクリップ",
    "nape braid": "うなじの編み込み",
    "parallel hairclips": "平行に並んだヘアクリップ",
    "pink petals": "ピンク色の花びら",
    "playing video games": "テレビゲームをする",
    "print pantyhose": "柄入りパンスト",
    "ribbon in braid": "編み込みのリボン",
    "see-through veil": "透けるベール",
    "side cape": "サイドケープ",
    "single hair streak": "一本の髪のメッシュ",
    "small sweatdrop": "小さな汗のしずく",
    "sphere earrings": "球形のイヤリング",
    "sphere hair ornament": "球形の髪飾り",
    "star symbol background": "星の記号の背景",
    "swim ring": "浮き輪",
    "teardrop earrings": "涙形のイヤリング",
    "traditional halo": "伝統的な光輪",
    "two-tone shoes": "2色の靴",
    "vertical-striped background": "縦ストライプの背景",
    "waist ribbon": "腰のリボン",
    "window shadow": "窓の影",
}

EXTRA_EXACT = {
    "aqua trim": "水色の縁取り", "animal charm": "動物モチーフのチャーム", "animal-themed food": "動物モチーフの食べ物",
    "arched bangs": "アーチ状の前髪", "argyle pantyhose": "アーガイル柄のパンスト", "baby animal": "動物の赤ちゃん",
    "bandana around neck": "首にバンダナ", "bandana around arm": "腕にバンダナ", "black arm warmers": "黒いアームウォーマー",
    "black hanfu": "黒い漢服", "black shrug": "黒いボレロ", "black trim": "黒い縁取り", "blonde streaks": "金髪のメッシュ",
    "blue haori": "青い羽織", "blue hanfu": "青い漢服", "blue eyeliner": "青いアイライン", "blue shrug": "青いボレロ",
    "buttoned cuffs": "ボタン付きカフス", "center-flap bangs": "中央が割れた前髪", "character charm": "キャラクターチャーム",
    "choppy bangs": "不揃いな前髪", "colored blood": "色付きの血", "criss-cross straps": "交差したストラップ",
    "diagonal-striped background": "斜めストライプの背景", "diamond-shaped earrings": "ひし形のイヤリング", "doodle inset": "落書きの挿入枠",
    "drop-shaped pupils": "しずく形の瞳孔", "drink carton": "紙パック飲料", "elbow carry": "肘で抱える",
    "flower focus": "花を中心に描く", "flower-trimmed sleeves": "花飾り付きの袖", "fluffy clothes": "ふわふわした服",
    "full beard": "豊かなひげ", "full page comic": "全面漫画", "gauze on cheek": "頬のガーゼ", "gauze on face": "顔のガーゼ",
    "gold bracer": "金色の腕甲", "gold jewelry": "金色の宝飾品", "gold circlet": "金色のサークレット", "gold thighlet": "金色の太もも飾り",
    "goatee stubble": "あごひげの剃り跡", "green haori": "緑の羽織", "green hanfu": "緑の漢服", "green shrug": "緑のボレロ",
    "half crown braid": "ハーフクラウンブレイド", "hand on own ear": "自分の耳に手を当てる", "heart ear ornament": "ハート形の耳飾り",
    "heart halo": "ハート形の光輪", "high side ponytail": "高い位置のサイドポニー", "holding bass guitar": "ベースギターを持つ",
    "holding burger": "ハンバーガーを持つ", "holding cotton candy": "綿あめを持つ", "holding drink carton": "紙パック飲料を持つ",
    "holding flute": "フルートを持つ", "holding milk carton": "牛乳パックを持つ", "holding violin": "バイオリンを持つ",
    "horn hairband": "角のヘアバンド", "instrument case on back": "背中の楽器ケース", "jacket over hoodie": "パーカーの上にジャケット",
    "kinky hair": "縮れ毛", "large horns": "大きな角", "lollipop in mouth": "口に棒付きキャンディー",
    "loose hair strand": "ほつれ毛", "lower eyelashes only": "下まつげのみ", "mechanical eyes": "機械の目",
    "melting popsicle": "溶けかけのアイスキャンディー", "middle ring": "中央の指輪", "military dress uniform": "軍礼装",
    "multicolored boots": "多色のブーツ", "multicolored hat": "多色の帽子", "multicolored shoes": "多色の靴",
    "mustache stubble": "口ひげの剃り跡", "nun headdress": "修道女の頭飾り", "on bicycle": "自転車の上",
    "on boat": "ボートの上", "on car": "車の上", "on innertube": "浮き輪の上", "on rooftop": "屋上の上",
    "on swing": "ブランコの上", "on throne": "玉座の上", "ornate border": "装飾的な縁取り", "parallel piercings": "平行に並んだピアス",
    "pink arm warmers": "ピンク色のアームウォーマー", "pink leg warmers": "ピンク色のレッグウォーマー", "pink slippers": "ピンク色のスリッパ",
    "plaid hat": "タータンチェックの帽子", "pointy boots": "尖ったブーツ", "reaching towards another": "相手に手を伸ばす",
    "red haori": "赤い羽織", "red hanfu": "赤い漢服", "red shrug": "赤いボレロ", "reflection focus": "反射を中心に描く",
    "ribbon in braid": "編み込みのリボン", "rounded collar": "丸襟", "segmented comic": "分割された漫画", "sharp tail": "尖った尻尾",
    "short-sleeved jacket": "半袖ジャケット", "side up bun": "サイドアップのお団子", "silver skin": "銀色の肌",
    "simple bird": "簡素な鳥", "single bare foot": "片足裸足", "single off shoulder": "片側の肩出し",
    "snow leopard ears": "ユキヒョウの耳", "snow leopard tail": "ユキヒョウの尻尾", "sparkling aura": "きらめくオーラ",
    "spreading own hair": "自分の髪を広げる", "star symbol background": "星の記号の背景", "thick beard": "濃いひげ",
    "thick mustache": "濃い口ひげ", "triangle facial mark": "三角形の顔の印", "two-tone horns": "2色の角",
    "two-tone one-piece swimsuit": "2色のワンピース水着", "under-elbow gloves": "肘下までの手袋", "uneven horns": "不揃いな角",
    "viewer holding phone": "見る側がスマホを持つ", "white bridal gauntlets": "白い花嫁用ガントレット", "white hanfu": "白い漢服",
    "white shrug": "白いボレロ", "yellow armband": "黄色い腕章", "yellow trim": "黄色の縁取り",
}

COLORS = {
    "aqua": "水色の",
    "black": "黒い",
    "blue": "青い",
    "brown": "茶色の",
    "gold": "金色の",
    "green": "緑の",
    "grey": "灰色の",
    "orange": "オレンジ色の",
    "pink": "ピンク色の",
    "purple": "紫の",
    "red": "赤い",
    "silver": "銀色の",
    "white": "白い",
    "yellow": "黄色い",
}

NOUNS = {
    "academy": "学園", "animal": "動物", "arm": "腕", "arms": "腕", "armor": "鎧", "background": "背景", "bag": "バッグ", "belt": "ベルト",
    "boots": "ブーツ", "border": "縁取り", "bow": "リボン結び", "boots": "ブーツ",
    "bikini": "ビキニ", "bird": "鳥", "blush": "赤面", "bra": "ブラジャー", "cape": "ケープ", "chain": "チェーン", "chest": "胸元",
    "clothes": "服", "coat": "コート", "collar": "襟", "crown": "王冠",
    "cuffs": "カフス", "dress": "ドレス", "ear": "耳", "ears": "耳", "eye": "目", "eyes": "目", "female": "女性",
    "earrings": "イヤリング", "eyewear": "アイウェア", "face": "顔", "feet": "足",
    "finger": "指", "fingers": "指", "flag": "旗", "flower": "花", "foot": "足", "food": "食べ物",
    "glasses": "眼鏡", "gloves": "手袋", "gym": "体育", "hair": "髪", "hairband": "ヘアバンド",
    "hairclip": "ヘアクリップ", "hairclips": "ヘアクリップ", "hairpin": "ヘアピン", "hairtie": "髪留め", "halo": "光輪",
    "hand": "手", "hands": "手", "hat": "帽子", "head": "頭", "headscarf": "ヘッドスカーフ",
    "helmet": "ヘルメット", "hood": "フード", "jacket": "ジャケット", "kimono": "着物",
    "lace": "レース", "legs": "脚", "leotard": "レオタード", "logo": "ロゴ", "mask": "マスク", "male": "男性",
    "mark": "印", "mouth": "口", "neck": "首", "necklace": "ネックレス", "neckwear": "首元の装飾",
    "nose": "鼻", "ornament": "髪飾り", "pants": "ズボン", "panties": "パンツ", "petals": "花びら", "pistol": "拳銃",
    "pantyhose": "パンスト", "pendant": "ペンダント", "piercing": "ピアス", "print": "柄",
    "ribbon": "リボン", "ring": "指輪", "sandals": "サンダル", "scarf": "マフラー",
    "shirt": "シャツ", "shoes": "靴", "shorts": "ショートパンツ", "shoulder": "肩", "shoulders": "肩",
    "skirt": "スカート", "sleeves": "袖", "socks": "靴下", "streaks": "メッシュ", "stomach": "お腹",
    "sidelocks": "横髪", "suit": "スーツ", "suspenders": "サスペンダー", "swimsuit": "水着", "symbol": "記号", "tail": "尻尾",
    "tattoo": "タトゥー", "thigh": "太もも", "thighhighs": "ニーハイ",
    "tie": "ネクタイ", "top": "トップス", "uniform": "制服", "veil": "ベール", "vest": "ベスト",
    "visor": "バイザー", "waist": "腰", "weapon": "武器", "wings": "翼", "wrist": "手首",
}

ADJECTIVES = {
    "alternate": "別の", "arched": "アーチ状の", "blunt": "切りそろえた", "choppy": "不揃いな",
    "colored": "色付きの", "curly": "巻き毛の", "double": "二重の", "floating": "浮かぶ",
    "floral": "花柄の", "frilled": "フリル付きの", "full": "全体の", "glowing": "光る",
    "high": "高い位置の", "large": "大きな", "long": "長い", "low": "低い位置の",
    "loose": "ゆるい", "many": "多数の", "multiple": "複数の", "open": "開いた", "parallel": "平行な",
    "ornate": "装飾的な", "partially": "部分的に", "pointed": "尖った", "short": "短い",
    "single": "一本の", "small": "小さな", "soft": "柔らかな", "spiked": "とげ付きの",
    "striped": "ストライプ柄の", "thick": "太い", "thin": "細い", "torn": "破れた", "traditional": "伝統的な",
    "two-tone": "2色の", "uneven": "不揃いな", "vertical-striped": "縦ストライプの",
    "white": "白い", "wide": "幅広い",
}

SKIP_WORDS = {
    "cosplay", "meme", "style", "project", "genshin", "pokemon", "nikke", "umamusume",
    "vocaloid", "touhou", "archive", "username", "fate", "sekai", "honkai",
    "fanart", "identity",
    "penis", "pussy", "breasts", "breast", "ass", "anus", "anal", "cum", "sex",
    "vagina", "dick", "nipple", "tentacle", "vore", "futa", "sexual", "fetish",
}


def exact_translation(tag: str) -> str:
    return EXACT.get(tag.lower(), "") or EXTRA_EXACT.get(tag.lower(), "")


def translate_composite(tag: str) -> str:
    lower = tag.lower().strip()
    if not lower or any(char.isdigit() for char in lower) or "(" in lower or ")" in lower:
        return ""
    if any(token in SKIP_WORDS for token in re.findall(r"[a-z]+", lower)):
        return ""
    words = re.findall(r"[a-z]+(?:-[a-z]+)?", lower)
    if not words or len(words) > 5:
        return ""
    if lower in EXACT:
        return EXACT[lower]
    if words[0] in COLORS and len(words) == 2 and words[1] in NOUNS:
        return COLORS[words[0]] + NOUNS[words[1]]
    if words[0] in COLORS and len(words) == 3 and all(word in NOUNS for word in words[1:]):
        return COLORS[words[0]] + NOUNS[words[1]] + "の" + NOUNS[words[2]]
    if words[0] in ADJECTIVES and len(words) == 2 and words[1] in NOUNS and words[1] != "print":
        return ADJECTIVES[words[0]] + NOUNS[words[1]]
    if words[0] in ADJECTIVES and len(words) == 3 and words[1] in NOUNS and words[2] in NOUNS:
        return ADJECTIVES[words[0]] + NOUNS[words[1]] + "の" + NOUNS[words[2]]
    if len(words) == 2 and words[0] in NOUNS and words[1] in NOUNS:
        return NOUNS[words[0]] + "の" + NOUNS[words[1]]
    if words[0] in {"animal", "bird", "cat", "cow", "fish", "rabbit", "snake", "snow", "flower"} and len(words) == 3 and words[1] in {"ear", "ears", "hair", "tail"} and words[2] in NOUNS:
        animal = {"animal": "動物", "bird": "鳥", "cat": "猫", "cow": "牛", "fish": "魚", "rabbit": "ウサギ", "snake": "蛇", "snow": "雪", "flower": "花"}[words[0]]
        return animal + NOUNS[words[1]] + "の" + NOUNS[words[2]]
    if words[0] == "holding" and len(words) == 2 and words[1] in NOUNS:
        return NOUNS[words[1]] + "を持つ"
    if words[0] == "floating" and len(words) == 2 and words[1] in NOUNS:
        return "浮かぶ" + NOUNS[words[1]]
    if words[0] == "on" and len(words) == 2 and words[1] in NOUNS:
        return NOUNS[words[1]] + "の上"
    if words[0] == "in" and len(words) == 2 and words[1] in NOUNS:
        return NOUNS[words[1]] + "の中"
    if words[0] == "with" and len(words) == 2 and words[1] in NOUNS:
        return NOUNS[words[1]] + "付き"
    if words[-1] == "print" and len(words) == 2:
        print_words = {"argyle": "アーガイル", "checkered": "チェック", "cow": "牛", "floral": "花", "fruit": "果物", "plaid": "タータンチェック", "polka": "水玉", "striped": "ストライプ"}
        return (COLORS.get(words[0], print_words.get(words[0], "")) + "柄") if words[0] in COLORS or words[0] in print_words else ""
    if words[-1] == "background" and len(words) == 2:
        base = COLORS.get(words[0], NOUNS.get(words[0], ""))
        return base + "背景" if base else ""
    if words[-1] == "streaks" and len(words) == 2 and words[0] in COLORS:
        return COLORS[words[0]] + "メッシュ"
    return ""


def main() -> int:
    translations: dict[str, str] = {}
    examined = translated = 0
    by_category: dict[str, dict[str, int]] = {}
    for filename, category in (("tags-general.json", "general"), ("tags-meta.json", "meta")):
        rows = json.loads((TAGDB / filename).read_text(encoding="utf-8"))
        stats = {"examined": 0, "translated": 0, "skipped": 0}
        for row in rows:
            if row.get("jp"):
                continue
            examined += 1
            stats["examined"] += 1
            tag = str(row.get("tag", "")).strip()
            translation = exact_translation(tag) or translate_composite(tag)
            if translation:
                translations[tag] = translation
                translated += 1
                stats["translated"] += 1
            else:
                stats["skipped"] += 1
        by_category[category] = stats
    payload = {
        "schemaVersion": 1,
        "source": "NAI Studio conservative Japanese supplement",
        "method": "Curated exact translations and conservative compositional rules; proper nouns, ambiguous phrases, and sensitive terms are intentionally left untranslated.",
        "priority": "upstream jp > supplement > English tag",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "stats": {"examined": examined, "translated": translated, "skipped": examined - translated, "byCategory": by_category},
        "translations": dict(sorted(translations.items(), key=lambda item: item[0].casefold())),
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
