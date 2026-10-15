# kyodaihub-events — AI / 開発者向け概要

チャットや PC（Mac / Windows）が変わっても、意図と制約を引き継ぐための正本。コードを触る前に読む。仕組みと動かし方は `README.md`。

## これは何か

- 京都大学公式サイトのイベント一覧（https://www.kyoto-u.ac.jp/ja/event）を1日1回読み、アプリ「京大ポケット」用の `events.json` とチラシ画像を作って、GitHub Pages（`https://minakei02.github.io/kyodaihub-events/events.json`）で配る。
- GitHub Actions（`.github/workflows/sync.yml`）が毎日 5:30（日本時間）に動く。手動実行は Actions タブの「Run workflow」か `gh workflow run sync.yml`。
- アプリ（`../kyodaihubMobile`）は起動時にこのファイルを1回読むだけで、イベントについて Firebase を使わない。

## 守ること

1. **内容は原文のまま。** 京都大学から「同じ内容を載せ、申し込みは公式サイトへ誘導するなら可」と許可を得ている。要約・言い換え・AI での書き換えをしない。各イベントの `externalUrl`（公式ページ）を必ず残す。
2. **京大サイトに負担をかけない。** `src/config.ts` のアクセス間隔（0.7 秒）・ページ数の上限を緩めない。前に作った画像は使い回し、新しいチラシだけを取りに行く仕組みを壊さない。
3. **安全装置を外さない。** 一覧が5件未満、または詳細の2割超が読めないときは、何も公開せずに失敗で終わる（前日の内容が残る）。
4. **サーバー代は0円のまま。** 有料のサービス・API・鍵を使わない。Actions は公開リポジトリの無料枠で動かし、GitHub に支払い方法を登録しない前提。
5. **これは公開リポジトリ。** 鍵・トークン・個人のメールアドレスを入れない。コミットの名前とメールは GitHub の匿名アドレスにする。**clone した直後（新しい PC では必ず）、コミットする前に次を実行する。**
   - `git config user.name "minakei02"`
   - `git config user.email "136055793+minakei02@users.noreply.github.com"`
6. ワークフローの権限は仕事ごとに最小限。使う部品は GitHub 公式（`actions/*`）だけで、版はコミットの番号で固定する。
7. コミットと push は頼まれたときだけ。返答は日本語で。

## よく変えるところ

- **分類の名前とまとめ方**: `src/config.ts` の `CATEGORY_BY_TAG`。京大のタグを学生に分かりやすい名前に言い換え、近いものをまとめている（公式 13 → 7）。変えると翌朝の更新で全員のアプリに反映される。新しい名前を足したときは、アプリの並び順 `EVENT_CATEGORY_ORDER`（`../kyodaihubMobile/src/lib/events.ts`）にも足す（足さなくても表示はされ、後ろに並ぶ）。
- **京大サイトの作りが変わって失敗したとき**: `src/kyoto-u.ts` の読み取り部分を直し、`npm test` と `npm run sync` で確かめる。

## 知っておくこと

- 配信ファイルは配信側と端末側でそれぞれ最大10分キャッシュされる。更新が端末に届くまで最大20分ほどかかる。
- `data/events.json` は、内容が変わった日だけ Actions が残す記録（差分を追うため。60日間動きがないと定期実行が止まるのを防ぐ役目もある）。手で編集しない。

## Mac / Windows

どちらでも `npm install` → `npm test` → `npm run sync`（`dist/` に出力）。Node.js 24 以上。改行は `.gitattributes` で LF に揃えてある。
