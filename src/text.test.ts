import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as cheerio from 'cheerio';
import { parseDetailPage, parseListPage } from './kyoto-u.ts';
import { htmlToText, parseEventDates } from './text.ts';

function toText(html: string): string {
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  return htmlToText($, $('#root').contents().get());
}

test('開催日: 1日だけ', () => {
  assert.deepEqual(parseEventDates(['2026年09月08日 火曜日']), ['2026-09-08']);
});

test('開催日: 離れた複数の日', () => {
  assert.deepEqual(parseEventDates(['2026年09月08日 火曜日', '2026年10月12日 月曜日']), [
    '2026-09-08',
    '2026-10-12',
  ]);
});

test('開催日: 終わりの年が省かれた期間', () => {
  assert.deepEqual(parseEventDates(['2026年10月07日 水曜日〜11月29日 日曜日']), [
    '2026-10-07',
    '2026-11-29',
  ]);
});

test('開催日: 年をまたぐ期間は翌年とみなす', () => {
  assert.deepEqual(parseEventDates(['2026年12月20日 日曜日〜01月15日 金曜日']), [
    '2026-12-20',
    '2027-01-15',
  ]);
});

test('開催日: 日付がなければ空', () => {
  assert.deepEqual(parseEventDates(['終了', '未定']), []);
});

test('本文: 段落・改行・箇条書き', () => {
  assert.equal(
    toText('<p> 一つ目の段落。</p>\n  <p>二行<br>に分かれる&nbsp;</p><ul><li>項目A</li>\n<li>項目B</li></ul>'),
    '一つ目の段落。\n\n二行\nに分かれる\n\n・項目A\n・項目B',
  );
});

test('本文: 見出しとラベルには印を付け、前を1行あける', () => {
  assert.equal(
    toText('<p>前文</p><h3> 概要</h3><p>中身</p><div class="field__label">定員</div>\n <div><p>50名</p></div>'),
    '前文\n\n■ 概要\n中身\n\n■ 定員\n50名',
  );
});

test('本文: 表は1行ずつ、セルを区切って並べる', () => {
  assert.equal(
    toText('<table><thead><tr><th>会場</th><th>日時</th></tr></thead><tbody><tr><td>大阪</td><td>10月9日<br>13時</td></tr></tbody></table>'),
    '会場 ｜ 日時\n大阪 ｜ 10月9日 13時',
  );
});

test('本文: script や style の中身は出さない', () => {
  assert.equal(toText('<p>本文</p><script>alert(1)</script><style>p{}</style>'), '本文');
});

const LIST_HTML = `
<article about="/ja/event/2026-07-15" class="node-list">
  <a href="/ja/event/2026-07-15" class="node-list__link">
    <div class="field--name-field-featured-image"><img src="/sites/default/files/styles/width_scale_80/public/2026-07/card-xyz.jpg?itok=q"
      data-srcset="/sites/default/files/styles/width_scale_960/public/2026-07/card-xyz.jpg?itok=r 960w"></div>
    <span class="field field--name-title">  サイト内のイベント </span>
  </a>
</article>
<article about="/ja/event/2026-07-01" class="node-list">
  <a href="http://example.kyoto-u.ac.jp/" class="node-list__link"><span class="field--name-title">外部ページのイベント</span></a>
</article>
<article about="/ja/event/2026-01-01" class="node-list">
  <a href="javascript:alert(1)" class="node-list__link"><span class="field--name-title">危ないリンク</span></a>
</article>
<article about="/ja/news/2026-01-01" class="node-list">
  <a href="/ja/news/2026-01-01" class="node-list__link"><span class="field--name-title">イベントではない</span></a>
</article>`;

test('一覧: サイト内・外部のリンクを読み、危ないリンクとイベント以外は除く', () => {
  assert.deepEqual(parseListPage(LIST_HTML), [
    {
      path: '/ja/event/2026-07-15',
      href: 'https://www.kyoto-u.ac.jp/ja/event/2026-07-15',
      title: 'サイト内のイベント',
      imageUrl: 'https://www.kyoto-u.ac.jp/sites/default/files/2026-07/card-xyz.jpg',
      imageFallbackUrl:
        'https://www.kyoto-u.ac.jp/sites/default/files/styles/width_scale_960/public/2026-07/card-xyz.jpg?itok=r',
    },
    {
      path: '/ja/event/2026-07-01',
      href: 'http://example.kyoto-u.ac.jp/',
      title: '外部ページのイベント',
      imageUrl: null,
      imageFallbackUrl: null,
    },
  ]);
});

const DETAIL_HTML = `
<div class="field field--name-field-category"><div class="field__item"><a href="/ja/tag/54">公開講座</a></div></div>
<h1 class="page-title"><span class="field--name-title">テスト講座</span></h1>
<article about="/ja/event/2026-07-15" class="node--type-event">
  <div class="field--name-field-poster-image"><picture>
    <img src="/sites/default/files/styles/width_scale_80/public/2026-07/flyer-abc.png?itok=x"
      data-srcset="/sites/default/files/styles/width_scale_320/public/2026-07/flyer-abc.png?itok=a 320w, /sites/default/files/styles/width_scale_960/public/2026-07/flyer-abc.png?itok=b 960w">
  </picture></div>
  <div class="field--name-field-event-date"><div class="field__item">2026年09月08日 火曜日</div><div class="field__item">2026年10月12日 月曜日</div></div>
  <div class="field--name-field-event-time"><div class="field__item"><p>18時00分～20時00分</p></div></div>
  <div class="field--name-field-venue"><div class="field__item"><a>吉田キャンパス</a></div><div class="field__item"><a>オンライン</a></div></div>
  <div class="field--name-field-target"><div class="field__item"><a>在学生の方</a></div></div>
  <div class="field--name-field-entry-required"><div class="field__item">要申し込み</div></div>
  <div class="field field--name-body"><p>紹介文です。</p></div>
  <section class="node-full__section"><h2>基本情報</h2><div class="field__label">定員</div><div class="field__item"><p>50名</p></div></section>
  <div class="field--name-field-department-tag"><div class="field__item"><a>文学部</a></div><div class="field__item"><a>京大オリジナル</a></div></div>
</article>`;

test('詳細: 各項目を読み取る', () => {
  const card = {
    path: '/ja/event/2026-07-15',
    href: 'https://www.kyoto-u.ac.jp/ja/event/2026-07-15',
    title: '一覧での題名',
    imageUrl: 'https://www.kyoto-u.ac.jp/sites/default/files/2026-07/card-xyz.jpg',
    imageFallbackUrl: null,
  };
  assert.deepEqual(parseDetailPage(DETAIL_HTML, card), {
    id: 'ku-2026-07-15',
    title: 'テスト講座',
    startDate: '2026-09-08',
    endDate: '2026-10-12',
    location: '吉田キャンパス・オンライン',
    category: '学ぶ・講座',
    sourceTag: '公開講座',
    organizer: '文学部・京大オリジナル',
    description: '紹介文です。',
    sections: [
      {
        title: '開催概要',
        text: '■ 開催日\n2026年09月08日 火曜日\n2026年10月12日 月曜日\n\n■ 時間\n18時00分～20時00分\n\n■ 対象\n在学生の方\n\n■ 申し込み\n要申し込み',
      },
      { title: '基本情報', text: '■ 定員\n50名' },
    ],
    externalUrl: 'https://www.kyoto-u.ac.jp/ja/event/2026-07-15',
    posterUrl: 'https://www.kyoto-u.ac.jp/sites/default/files/2026-07/flyer-abc.png',
    posterFallbackUrl:
      'https://www.kyoto-u.ac.jp/sites/default/files/styles/width_scale_960/public/2026-07/flyer-abc.png?itok=b',
  });
});

const NO_POSTER_HTML = DETAIL_HTML.replace(
  /2026-07\/flyer-abc\.png/g,
  'default_images/default-event-poster-image.png',
);

test('詳細: 共通の代わりの画像はチラシとして扱わない', () => {
  const card = {
    path: '/ja/event/2026-07-15',
    href: 'https://museum.example/',
    title: '題名',
    imageUrl: null,
    imageFallbackUrl: null,
  };
  const event = parseDetailPage(NO_POSTER_HTML, card);
  assert.equal(event.posterUrl, null);
  assert.equal(event.posterFallbackUrl, null);
  assert.equal(event.externalUrl, 'https://museum.example/');
});

test('詳細: チラシがなければ、一覧のカードの画像を使う', () => {
  const card = {
    path: '/ja/event/2026-07-15',
    href: 'https://museum.example/',
    title: '題名',
    imageUrl: 'https://www.kyoto-u.ac.jp/sites/default/files/2026-07/card-xyz.jpg',
    imageFallbackUrl: 'https://www.kyoto-u.ac.jp/sites/default/files/styles/width_scale_960/public/2026-07/card-xyz.jpg',
  };
  const event = parseDetailPage(NO_POSTER_HTML, card);
  assert.equal(event.posterUrl, card.imageUrl);
  assert.equal(event.posterFallbackUrl, card.imageFallbackUrl);
});

test('詳細: 開催日が読めなければ失敗にする', () => {
  const html = DETAIL_HTML.replace(/\d{4}年\d{2}月\d{2}日/g, '未定');
  const card = {
    path: '/ja/event/2026-07-15',
    href: 'https://www.kyoto-u.ac.jp/ja/event/2026-07-15',
    title: '題名',
    imageUrl: null,
    imageFallbackUrl: null,
  };
  assert.throws(() => parseDetailPage(html, card), /開催日を読み取れません/);
});
