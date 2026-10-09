# kyodaihub-events

アプリ「京大ポケット」に載せるイベント情報を、1日1回、[京都大学公式サイトのイベント一覧](https://www.kyoto-u.ac.jp/ja/event)から取り込んで、ただのファイル（`events.json` とチラシ画像）として公開する仕組みです。

- 内容は公式サイトに載っているものをそのまま載せます。言い換えや要約はしません。
- 申し込みや最新の情報は、各イベントの `externalUrl`（公式ページ）に誘導します。
- サーバーも鍵も使いません。GitHub Actions が作り、GitHub Pages が配ります。

## 動かし方

```bash
npm install
npm run sync   # dist/ に events.json と images/ を作る（1分ほど）
npm test
```

公式サイトには 0.7 秒以上の間隔をあけて1つずつアクセスします。2回目からは、前に作った画像を使い回し、新しいチラシだけを取りに行きます。

## 毎日の自動実行

`.github/workflows/sync.yml` が毎日 5:30（日本時間）に動き、`dist/` を GitHub Pages に公開します。手動で動かすときは、GitHub の Actions タブから「イベント情報の同期」を選んで「Run workflow」を押します。

読み取りに失敗したとき（一覧が 5 件未満、または詳細の 2 割超が読めない）は、何も公開せずに失敗で終わります。公開中の内容は前日のまま残り、GitHub から失敗の通知メールが届きます。公式サイトの作りが変わった場合は `src/kyoto-u.ts` の読み取り部分を直します。

## 出力の形

```jsonc
{
  "version": 1,
  "generatedAt": "2026-10-09T13:00:00.000Z",
  "source": "https://www.kyoto-u.ac.jp/ja/event",
  "events": [
    {
      "id": "ku-2026-07-15",            // 公式サイトの詳細ページのパスから作る
      "title": "…",
      "startDate": "2026-09-08",        // 開催日のうち最初の日
      "endDate": "2026-10-12",          // 開催日のうち最後の日
      "location": "吉田キャンパス・オンライン",
      "category": "講座・見学会",        // アプリに出す分類。公式のタグの言い換え。対応表は src/config.ts
      "sourceTag": "公開講座",           // 公式サイトのタグ
      "organizer": "…",                 // 関連部局
      "description": "…",               // 紹介文
      "sections": [{ "title": "開催概要", "text": "…" }],
      "externalUrl": "https://www.kyoto-u.ac.jp/ja/event/2026-07-15",
      "images": [{ "thumbnail": "images/…-thumb.webp", "image": "images/…-cover.webp" }]
    }
  ]
}
```

画像のパスは `events.json` からの相対パスです。
