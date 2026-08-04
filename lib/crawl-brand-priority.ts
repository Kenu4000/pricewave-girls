const DAILY_BRANDS = `
ALICESOFT
戯画
Key
NitroPlus
Leaf
アトリエかぐや
あかべぇそふとつぅ
FrontWing
Purple software
ゆずソフト
Navel
AUGUST
âge / age
CIRCUS
ぱれっと
PULLTOP
elf
Whirlpool
light
SAGA PLANETS
Liar-soft
TYPE-MOON
ねこねこソフト
エウシュリー
minori
HOOKSOFT / HOOK
Lump of Sugar
CandySoft / きゃんでぃそふと
ASa Project
FAVORITE
CLOCKUP
SMEE
D.O. / ディーオー
Waffle
枕
ALcot
ソフトハウスキャラ
UNiSONSHIFT:Blossom
XUSE
ensemble
feng
ALcotハニカム
F&C
みなとそふと
Innocent Grey
BLACK Cyc
propeller
Clochette
ケロQ
暁WORKS
キャラメルBOX
Escu:de
ま～まれぇど
KID
しゃんぐりら
AXL
OVERDRIVE
あざらしそふと
BaseSon
MAGES. / 5pb.
あっぷりけ
あかべぇそふとすりぃ
きゃべつそふと
まどそふと
ωstar
MOONSTONE
ういんどみる
Chuablesoft
すたじお緑茶
CRYSTALiA
sprite
Qruppo
CUBE
ぱじゃまソフト
Lass
ILLUSION / Dreams
Black Lilith
TinkerBell
FLAT
コットンソフト
Studio e.go!
softhouse-seal
HARUKAZE
FlyingShine
AQUAPLUS
May-Be Soft / 有限会社リエーブル
rúf / ruf
HERMIT
hibiki works / 暁WORKS響SIDE
インレ
CROSS NET
カクテル・ソフト
BISHOP
シルキーズ
Laplacian
RUNE
Miel
C’s ware
Liquid
ういんどみるOasis
シルキーズプラスWASABI
わるきゅ～れ
Littlewitch
Selen
ルネ
Norn
Guilty
SQUEEZ
Overflow
ウグイスカグラ
tone work's
Hulotte
Studio Mebius
DualTail / DualMage
ハイクオソフト
すみっこソフト
JANIS
Triangle
アイル
工画堂スタジオ
BasiL
アトリエさくら Team.NTR
etude
アストロノーツ・シリウス
ZERO
Meteor
Campus
Frill
Le.Chocolat
脳内彼女
KISS
Mink
130cm
Sphere
Tactics
PROTOTYPE
GungHo Works
Interchannel
NECインターチャネル
フェアリーテール
3rdEye
softhouse-seal GRANDEE
WHITESOFT
UNiSONSHIFT
LiLiTH
Tarte
たぬきそふと
シルキーズプラスDOLCE
でぼの巣製作所
てぃ～ぐる
Ricotta
ROOT
BLACKRAINBOW
Anim
13cm
SkyFish
みなとカーニバル
CUFFS
GROOVER
MBS Truth
ANIPLEX.EXE
MOONSTONE Cherry
エンターグラム
すたじおみりす
ZyX
Cabbit
Lose
Active
Devil-seal
高屋敷開発
G.J?
Lillian
スミレ
Jellyfish
COSMIC CUTE
裸足少女
BLUE GALE
INTERHEART
S.M.L
Ciel
TOPCAT
ブルームハンドル
Terios
Alchemist
RusK
スパイク・チュンソフト
ETERNAL
プレカノ
つるみく
ちぇりーそふと
TerraLunar
mirai
角川書店
CRAFTWORK
アボガドパワーズ
Rosebleu
UNiSONSHIFT Accent.
トラヴュランス
Hearts
SORAHANE
あっぷりけ -妹-
マリン
Silver Bullet
エレクトリップ
Survive
DreamSoft / F&C FC03
Azurite
ninetail
ALL-TiME
raiL-soft
U・Me SOFT
NanaWind
WINTERS
GLOVETY
ぱれっとクオリア
DESSERT Soft
あざらしそふと+1
CROWD
たまソフト
PeasSoft
CYCLET
シルキーズプラスA5和牛
はむはむソフト
KAI
Qoo brand
NEXTON
`;

const DAILY_BRAND_ALIAS_GROUPS = [
  ["FrontWing", "フロントウィング", "フロントウイング"],
  ["NitroPlus", "Nitro+", "ニトロプラス"],
  ["Purple software", "パープルソフトウェア"],
  ["AQUAPLUS", "アクアプラス"],
  ["Liar-soft", "ライアーソフト"],
  ["Escu:de", "エスクード"],
  ["Overflow", "オーバーフロー"],
  ["BLUE GALE", "ブルーゲイル"],
  ["FlyingShine", "フライングシャイン"],
  ["UNiSONSHIFT", "ユニゾンシフト"],
  ["MAGES.", "MAGES.(5pb.)", "5pb."],
] as const;

const DAILY_PRODUCT_TITLES = ["CROSS†CHANNEL"] as const;
const BRAND_DETAIL_LABELS = new Set([
  "メーカー",
  "ブランド",
  "ブランド名",
  "発売元",
  "販売元",
  "開発元",
]);

function sourceLines(source: string): string[] {
  return source
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeCrawlBrand(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\s\u3000・･._\-‐‑–—:：'’`´"“”!?！？☆★+＋/／\\&＆×†]/gu, "");
}

function brandAliases(value: string): string[] {
  const aliases = new Set<string>();
  const add = (candidate: string) => {
    const normalized = normalizeCrawlBrand(candidate);
    if (normalized) aliases.add(normalized);
  };

  add(value);

  const parentheticalContents = [...value.matchAll(/[（(]([^()（）]+)[）)]/gu)].map(
    (match) => match[1].trim(),
  );
  for (const content of parentheticalContents) add(content);

  for (const candidate of [value, ...parentheticalContents]) {
    for (const part of candidate.split(/[／/×、]/u)) add(part);
  }

  return [...aliases];
}

const DAILY_BRAND_KEYS = new Set(
  [
    ...sourceLines(DAILY_BRANDS),
    ...DAILY_BRAND_ALIAS_GROUPS.flatMap((group) => [...group]),
  ].flatMap(brandAliases),
);
const DAILY_PRODUCT_TITLE_KEYS = DAILY_PRODUCT_TITLES.map(normalizeCrawlBrand);

function parseDetails(rawDetails: string | null | undefined): Record<string, string> {
  if (!rawDetails) return {};
  try {
    const parsed = JSON.parse(rawDetails) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

export function productBrandCandidates(
  manufacturer: string | null | undefined,
  detailsJson: string | null | undefined,
): string[] {
  const candidates = new Set<string>();
  if (manufacturer?.trim()) candidates.add(manufacturer.trim());

  for (const [label, value] of Object.entries(parseDetails(detailsJson))) {
    const normalizedLabel = label.normalize("NFKC").replace(/\s+/gu, "").trim();
    if (BRAND_DETAIL_LABELS.has(normalizedLabel) && value.trim()) {
      candidates.add(value.trim());
    }
  }

  return [...candidates];
}

export function isDailyCrawlBrand(candidates: string[]): boolean {
  return candidates.some((candidate) =>
    brandAliases(candidate).some((alias) => DAILY_BRAND_KEYS.has(alias)),
  );
}

export function isDailyCrawlProductTitle(title: string | null | undefined): boolean {
  const normalizedTitle = normalizeCrawlBrand(title ?? "");
  return DAILY_PRODUCT_TITLE_KEYS.some((key) => normalizedTitle.includes(key));
}

export function crawlPriorityForProduct(
  title: string | null | undefined,
  manufacturer: string | null | undefined,
  detailsJson: string | null | undefined,
): "daily" | "rotation" {
  if (isDailyCrawlProductTitle(title)) return "daily";
  return isDailyCrawlBrand(productBrandCandidates(manufacturer, detailsJson))
    ? "daily"
    : "rotation";
}

export const dailyCrawlBrandKeyCount = DAILY_BRAND_KEYS.size;
export const dailyCrawlProductTitleCount = DAILY_PRODUCT_TITLE_KEYS.length;
