# 商品タイトルの表示整形

最終更新: 2026-09-07

## 目的

駿河屋の商品名には、商品本体のタイトルより前に機種・媒体カテゴリが付くものが多い。

例:

```text
WindowsXP/Vista/7 DVDソフト 闇夜に踊れ -Witch wishes to commit the Night-
```

一覧で作品名を先に視認できるよう、表示時だけ次の順へ並べ替える。

```text
闇夜に踊れ -Witch wishes to commit the Night-　WindowsXP/Vista/7 DVDソフト
```

## 重要な原則

- **DBの `Product.title` は変更しない。**
- 駿河屋から取得した生の商品名をそのまま保存する。
- 検索、関連商品の判定、シリーズ判定など内部処理は従来どおり生タイトルを使う。
- 並べ替えるのはUI上の表示だけ。

## 対象

先頭が次のようなPC機種表記で始まり、商品名との間に `ソフト` があるタイトルを対象にする。

- Windows
- Macintosh / Mac / Mac OS
- PC-98
- X68000
- FM-TOWNS
- MS-DOS / DOS

`DVDソフト`、`DVD ソフト`、`CDソフト`、`CD-ROMソフト`等は、先頭から最初の `ソフト` までを一つの機種・媒体表記として末尾へ移す。

通常の商品名や、先頭が対象機種表記ではない文字列は変更しない。

## 実装

ローカルNext.js:

- `lib/product-display-title.ts`
- `components/ProductGrid.tsx`
- `app/changes/page.tsx`
- `app/products/[id]/page.tsx`
- `lib/series-catalog.ts`（シリーズグラフ凡例）

Viewer:

- `viewer/product-title-display.js`
- `viewer/enhancement-runtime.js` の単一MutationObserverへenhancementとして登録する。
- Viewer内部のJSONや検索用データは書き換えない。

## 回帰テスト

- `lib/product-display-title.test.ts`
- `lib/viewer-product-title-display.test.ts`
- `lib/series-catalog.test.ts`
