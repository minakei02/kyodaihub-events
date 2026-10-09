import * as cheerio from 'cheerio';
import {
  CATEGORY_BY_TAG,
  FALLBACK_CATEGORY,
  LIST_PATH,
  MAX_LIST_PAGES,
  REQUEST_INTERVAL_MS,
  REQUEST_TIMEOUT_MS,
  SITE_ORIGIN,
  USER_AGENT,
  type AppCategory,
} from './config.ts';
import { cleanInline, htmlToText, parseEventDates } from './text.ts';

/** 一覧の1枚ぶん。path は京大サイト内の詳細ページ、href はカードを押したときの行き先 */
export type ListCard = {
  path: string;
  href: string;
  title: string;
  /** 一覧のカードに出ている画像。詳細ページにチラシがないイベントで代わりに使う */
  imageUrl: string | null;
  imageFallbackUrl: string | null;
};

export type EventSection = {
  title: string;
  text: string;
};

/** 詳細ページから読み取った内容。画像はまだ取り込んでいない */
export type ScrapedEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  category: AppCategory;
  sourceTag: string;
  organizer: string;
  description: string;
  sections: EventSection[];
  /** 申し込みや詳細の誘導先。京大サイトの詳細ページか、京大サイトが案内している公式ページ */
  externalUrl: string;
  /** チラシ画像の元ファイル。チラシがなければ null */
  posterUrl: string | null;
  /** 元ファイルが取れないときに使う、京大サイトが表示用に作っている一番大きい縮小版 */
  posterFallbackUrl: string | null;
};

let lastRequestAt = 0;

/** 取り込み元へのアクセスは、必ず間隔をあけて1つずつ行う */
async function politeFetch(url: string): Promise<Response> {
  const wait = lastRequestAt + REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ja' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response;
}

/** 一時的な失敗に備えて、少し待ってもう一度だけ試す */
async function fetchWithRetry(url: string): Promise<Response> {
  try {
    return await politeFetch(url);
  } catch (first) {
    console.warn(`  再試行します: ${(first as Error).message}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return politeFetch(url);
  }
}

export async function fetchText(url: string): Promise<string> {
  return (await fetchWithRetry(url)).text();
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  return Buffer.from(await (await fetchWithRetry(url)).arrayBuffer());
}

/** http(s) の絶対 URL にする。それ以外（javascript: など）は null */
function toWebUrl(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, SITE_ORIGIN);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 画像の表示用の縮小版の URL から、元ファイルの URL を作る */
function toOriginalImageUrl(src: string | undefined): string | null {
  const url = toWebUrl(src);
  if (!url) return null;
  const parsed = new URL(url);
  // チラシ未登録のイベントに出る、共通の代わりの画像は使わない
  if (parsed.pathname.includes('/default_images/')) return null;
  parsed.pathname = parsed.pathname
    .replace(/\/styles\/[^/]+\/public\//, '/')
    .replace(/(\.(?:png|jpe?g|gif))\.webp$/i, '$1');
  parsed.search = '';
  return parsed.toString();
}

/** srcset（「URL 幅w, URL 幅w, …」）から、一番幅の大きい URL を選ぶ */
function largestFromSrcset(srcset: string | undefined): string | null {
  const candidates = (srcset ?? '')
    .split(',')
    .map((entry) => entry.trim().split(/\s+/))
    .map(([url, width]) => ({ url, width: Number.parseInt(width ?? '0', 10) || 0 }))
    .filter((candidate) => candidate.url)
    .sort((a, b) => b.width - a.width);
  return toWebUrl(candidates[0]?.url);
}

/** img 要素から、元ファイルと、それが取れないときの縮小版の URL を読む */
function readImage(img: { attr: (name: string) => string | undefined }) {
  const url = toOriginalImageUrl(img.attr('src'));
  return { url, fallbackUrl: url ? largestFromSrcset(img.attr('data-srcset')) : null };
}

export function parseListPage(html: string): ListCard[] {
  const $ = cheerio.load(html);
  const cards: ListCard[] = [];

  $('article.node-list').each((_, element) => {
    const article = $(element);
    const path = article.attr('about') ?? '';
    if (!/^\/ja\/event\/[\w-]+$/.test(path)) return;

    const href = toWebUrl(article.find('a.node-list__link').attr('href'));
    const title = cleanInline(article.find('.field--name-title').first().text());
    if (!href || !title) return;

    const image = readImage(article.find('.field--name-field-featured-image img').first());
    cards.push({ path, href, title, imageUrl: image.url, imageFallbackUrl: image.fallbackUrl });
  });

  return cards;
}

/** 一覧を最後のページまでたどって、載っているイベントをすべて集める */
export async function fetchAllCards(): Promise<ListCard[]> {
  const byPath = new Map<string, ListCard>();

  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const cards = parseListPage(await fetchText(`${SITE_ORIGIN}${LIST_PATH}?page=${page}`));
    const fresh = cards.filter((card) => !byPath.has(card.path));
    console.log(`一覧 ${page + 1} ページ目: ${cards.length} 件`);
    // 最後のページを過ぎると、空か、同じ内容の繰り返しになる
    if (fresh.length === 0) break;
    for (const card of fresh) byPath.set(card.path, card);
  }

  return [...byPath.values()];
}

export function parseDetailPage(html: string, card: ListCard): ScrapedEvent {
  const $ = cheerio.load(html);
  const article = $(`article[about="${card.path}"]`).first();
  if (article.length === 0) throw new Error(`詳細ページの本体が見つかりません: ${card.path}`);

  const items = (selector: string): string[] =>
    article
      .find(`${selector} .field__item`)
      .map((_, element) => cleanInline($(element).text()))
      .get()
      .filter(Boolean);
  const blockText = (selector: string): string =>
    htmlToText($, article.find(selector).first().contents().get());

  const title = cleanInline($('h1.page-title').first().text()) || card.title;
  const poster = readImage(article.find('.field--name-field-poster-image img').first());

  const dateTexts = items('.field--name-field-event-date');
  const dates = parseEventDates(dateTexts);
  if (dates.length === 0) throw new Error(`開催日を読み取れません: ${card.path}`);

  const sourceTag = cleanInline($('.field--name-field-category .field__item').first().text());
  const venues = items('.field--name-field-venue');
  const targets = items('.field--name-field-target');
  const entry = cleanInline(article.find('.field--name-field-entry-required .field__item').text());
  const time = htmlToText(
    $,
    article.find('.field--name-field-event-time .field__item').contents().get(),
  );

  // 一覧の「開始日〜終了日」では伝わらない、個別の開催日・時間・対象・申し込み要否
  const overview = [
    ['開催日', dateTexts.join('\n')],
    ['時間', time],
    ['対象', targets.join('、')],
    ['申し込み', entry],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `■ ${label}\n${value}`)
    .join('\n\n');

  const sections: EventSection[] = overview ? [{ title: '開催概要', text: overview }] : [];
  article.find('section.node-full__section').each((_, element) => {
    const section = $(element);
    const heading = cleanInline(section.children('h2').first().text());
    const text = htmlToText($, section.contents().not('h2').get());
    if (heading && text) sections.push({ title: heading, text });
  });

  return {
    id: `ku-${card.path.split('/').pop()}`,
    title,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    location: venues.join('・'),
    category: CATEGORY_BY_TAG[sourceTag] ?? FALLBACK_CATEGORY,
    sourceTag,
    organizer: items('.field--name-field-department-tag').join('・'),
    description: blockText('.field--name-body'),
    sections,
    externalUrl: card.href,
    posterUrl: poster.url ?? card.imageUrl,
    posterFallbackUrl: poster.url ? poster.fallbackUrl : card.imageFallbackUrl,
  };
}

export async function fetchEvent(card: ListCard): Promise<ScrapedEvent> {
  return parseDetailPage(await fetchText(`${SITE_ORIGIN}${card.path}`), card);
}
