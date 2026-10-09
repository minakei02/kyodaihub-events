import type { AnyNode, Element } from 'domhandler';
import type { CheerioAPI } from 'cheerio';

/** ここで改行して1かたまりにする要素 */
const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);
const HEADING_TAGS = new Set(['h2', 'h3', 'h4', 'h5', 'h6']);
const SKIPPED_TAGS = new Set(['script', 'style', 'noscript', 'template']);

function hasClass(element: Element, name: string): boolean {
  return (element.attribs.class ?? '').split(/\s+/).includes(name);
}

/**
 * 本文の HTML を、アプリでそのまま表示できる文章にする。
 * 言い回しは変えず、段落・箇条書き・見出し・表の区切りだけを改行や記号に置き換える。
 */
export function htmlToText($: CheerioAPI, roots: AnyNode[]): string {
  let out = '';

  function breakLine() {
    if (out !== '' && !out.endsWith('\n')) out += '\n';
  }

  function walk(node: AnyNode) {
    if (node.type === 'text') {
      // 元の HTML の改行や字下げは見た目に関係ないので、空白1つにまとめる
      const text = node.data.replace(/[\s\u00a0]+/g, ' ');
      // 行の先頭（見出しや箇条書きの記号の直後を含む）の空白は捨てる
      const atLineStart = out === '' || /(?:\n|■ |・)$/.test(out);
      out += atLineStart ? text.trimStart() : text;
      return;
    }
    if (node.type !== 'tag') return;

    const tag = node.name.toLowerCase();
    if (SKIPPED_TAGS.has(tag)) return;
    if (tag === 'br') {
      out += '\n';
      return;
    }
    if (tag === 'td' || tag === 'th') {
      const cell = htmlToText($, node.children).replace(/\n+/g, ' ');
      if (!out.endsWith('\n') && out !== '') out += ' ｜ ';
      out += cell;
      return;
    }

    const block = BLOCK_TAGS.has(tag);
    const label = hasClass(node, 'field__label');
    if (block) breakLine();
    if (HEADING_TAGS.has(tag) || label) {
      // 見出しの前は1行あける
      if (out !== '' && !out.endsWith('\n\n')) out += '\n';
      out += '■ ';
    }
    if (tag === 'li') out += '・';
    for (const child of node.children) walk(child);
    if (block) breakLine();
    if (tag === 'p') out += '\n';
  }

  for (const root of roots) walk(root);

  return out
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 1行の短い文字列用。前後と途中の余分な空白を取る */
export function cleanInline(value: string): string {
  return value.replace(/[\s\u00a0]+/g, ' ').trim();
}

/** 日付を YYYY-MM-DD にする */
function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 「2026年09月08日 火曜日」「2026年10月07日 水曜日〜11月29日 日曜日」のような開催日の表記から、
 * 含まれる日付をすべて取り出す。年が省かれた日付は直前の年を引き継ぎ、月が戻っていたら翌年とみなす。
 */
export function parseEventDates(texts: string[]): string[] {
  const dates: string[] = [];
  const pattern = /(?:(\d{4})年)?\s*(\d{1,2})月\s*(\d{1,2})日/g;

  for (const text of texts) {
    let year: number | null = null;
    let previousMonth = 0;
    for (const match of text.matchAll(pattern)) {
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (match[1]) {
        year = Number(match[1]);
      } else if (year !== null && month < previousMonth) {
        year += 1;
      }
      if (year === null) continue;
      previousMonth = month;
      dates.push(toIsoDate(year, month, day));
    }
  }

  return [...new Set(dates)].sort();
}
