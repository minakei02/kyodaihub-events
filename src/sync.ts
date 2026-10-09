import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  LIST_PATH,
  MAX_DETAIL_FAILURE_RATIO,
  MIN_EVENTS,
  SITE_ORIGIN,
} from './config.ts';
import {
  prepareImages,
  restoreImages,
  type EventImage,
  type ImageSource,
} from './images.ts';
import { fetchAllCards, fetchEvent, type ScrapedEvent } from './kyoto-u.ts';

/** events.json の1件ぶん。アプリはこの形を読む */
export type FeedEvent = Omit<ScrapedEvent, 'posterUrl' | 'posterFallbackUrl'> & {
  images: EventImage[];
};

export type Feed = {
  version: 1;
  generatedAt: string;
  source: string;
  events: FeedEvent[];
};

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: 'dist' },
    'previous-site': { type: 'string' },
  },
});

const outDir = args.out;
/** 作っている途中のものを公開用フォルダに混ぜないよう、別の場所で作ってから入れ替える */
const buildDir = `${outDir}.tmp`;
const previousSiteUrl = args['previous-site']
  ? args['previous-site'].replace(/\/?$/, '/')
  : null;

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** 前回の events.json。手元の出力フォルダになければ、公開中のサイトから読む */
async function loadPreviousFeed(): Promise<Feed | null> {
  try {
    return JSON.parse(await readFile(join(outDir, 'events.json'), 'utf8')) as Feed;
  } catch {
    // 手元にない
  }
  if (!previousSiteUrl) return null;
  try {
    const response = await fetch(new URL('events.json', previousSiteUrl), {
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok ? ((await response.json()) as Feed) : null;
  } catch {
    return null;
  }
}

const INDEX_HTML = `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>京大ポケット イベントデータ</title>
<p>アプリ「京大ポケット」が読むイベント情報です。内容は
<a href="${SITE_ORIGIN}${LIST_PATH}">京都大学公式サイトのイベント一覧</a>に掲載されているものです。
申し込みや最新の情報は、各イベントの公式ページをご確認ください。</p>
<p><a href="events.json">events.json</a></p>
`;

async function main() {
  const previous = await loadPreviousFeed();
  const previousById = new Map((previous?.events ?? []).map((event) => [event.id, event]));
  const imageOptions = {
    outDir: buildDir,
    previousDir: (await isDirectory(outDir)) ? outDir : null,
    previousSiteUrl,
  };

  const cards = await fetchAllCards();
  if (cards.length < MIN_EVENTS) {
    throw new Error(
      `一覧から ${cards.length} 件しか読み取れませんでした（下限 ${MIN_EVENTS} 件）。` +
        'サイトの構成が変わった可能性があるので、公開中の内容は変えずに中止します。',
    );
  }

  await rm(buildDir, { recursive: true, force: true });
  await mkdir(buildDir, { recursive: true });

  const events: FeedEvent[] = [];
  const failures: string[] = [];
  const imageCounts: Record<ImageSource, number> = {
    none: 0,
    kept: 0,
    'previous-site': 0,
    downloaded: 0,
  };

  for (const card of cards) {
    try {
      const scraped = await fetchEvent(card);
      const { posterUrl, posterFallbackUrl, ...event } = scraped;
      let images: EventImage[] = [];
      try {
        const result = await prepareImages(scraped, imageOptions);
        imageCounts[result.source] += 1;
        images = result.images;
      } catch (caught) {
        // チラシが取れなくても、イベント自体は載せる
        console.warn(`  チラシを用意できません: ${card.path}: ${(caught as Error).message}`);
        imageCounts.none += 1;
      }
      events.push({ ...event, images });
    } catch (caught) {
      failures.push(`${card.path}: ${(caught as Error).message}`);
      // 読み取れなかったイベントは、前回の内容があればそのまま載せ続ける
      const kept = previousById.get(`ku-${card.path.split('/').pop()}`);
      if (kept) {
        events.push({ ...kept, images: await restoreImages(kept.images, imageOptions) });
      }
    }
  }

  if (failures.length > 0) {
    console.warn(`読み取れなかったイベント ${failures.length} 件:\n  ${failures.join('\n  ')}`);
  }
  if (failures.length > cards.length * MAX_DETAIL_FAILURE_RATIO) {
    throw new Error(
      `${cards.length} 件中 ${failures.length} 件の詳細が読み取れませんでした。` +
        '公開中の内容は変えずに中止します。',
    );
  }

  const feed: Feed = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: `${SITE_ORIGIN}${LIST_PATH}`,
    events,
  };
  const json = JSON.stringify(feed, null, 1);
  await writeFile(join(buildDir, 'events.json'), json);
  await writeFile(join(buildDir, 'index.html'), INDEX_HTML);

  await rm(outDir, { recursive: true, force: true });
  await rename(buildDir, outDir);

  const added = events.filter((event) => !previousById.has(event.id)).length;
  const currentIds = new Set(events.map((event) => event.id));
  const removed = [...previousById.keys()].filter((id) => !currentIds.has(id)).length;
  console.log(
    [
      `完了: イベント ${events.length} 件（新規 ${added}・掲載終了 ${removed}）`,
      `画像: 京大サイトから取得 ${imageCounts.downloaded}・使い回し ${imageCounts.kept + imageCounts['previous-site']}・チラシなし ${imageCounts.none}`,
      `events.json: ${Math.round(Buffer.byteLength(json) / 1024)} KB`,
    ].join('\n'),
  );
}

main().catch(async (caught) => {
  console.error(`失敗: ${(caught as Error).message}`);
  await rm(buildDir, { recursive: true, force: true });
  process.exitCode = 1;
});
