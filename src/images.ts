import { createHash } from 'node:crypto';
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { COVER_WIDTH, THUMBNAIL_WIDTH } from './config.ts';
import { fetchBuffer, type ScrapedEvent } from './kyoto-u.ts';

/** events.json に書く画像。どちらも出力フォルダからの相対パス */
export type EventImage = {
  thumbnail: string;
  image: string;
};

export type ImageSource = 'none' | 'kept' | 'previous-site' | 'downloaded';

export type ImageResult = {
  images: EventImage[];
  source: ImageSource;
};

type ImageOptions = {
  outDir: string;
  /** 前回の実行で作った出力フォルダ。同じ画像があればそこから持ってくる */
  previousDir: string | null;
  /** 公開中のサイトの URL。前回の出力フォルダがないとき（GitHub Actions）にそこから持ってくる */
  previousSiteUrl: string | null;
};

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

/**
 * チラシのファイル名には元画像の URL から作った短い印を入れる。
 * 元画像が差し替わると名前も変わるので、アプリに古い画像が残らない。
 */
export function imagePathsFor(event: ScrapedEvent): EventImage | null {
  if (!event.posterUrl) return null;
  const mark = createHash('sha1').update(event.posterUrl).digest('hex').slice(0, 10);
  return {
    thumbnail: `images/${event.id}/${mark}-thumb.webp`,
    image: `images/${event.id}/${mark}-cover.webp`,
  };
}

/** 自分たちが前に作った画像を持ってくる。京大サイトには取りに行かない */
async function restore(path: string, options: ImageOptions): Promise<ImageSource | null> {
  const target = join(options.outDir, path);
  await mkdir(dirname(target), { recursive: true });

  if (options.previousDir) {
    const previous = join(options.previousDir, path);
    if (await exists(previous)) {
      await copyFile(previous, target);
      return 'kept';
    }
  }
  if (options.previousSiteUrl) {
    try {
      const response = await fetch(new URL(path, options.previousSiteUrl), {
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) {
        await writeFile(target, Buffer.from(await response.arrayBuffer()));
        return 'previous-site';
      }
    } catch {
      // 取れなければ、元の画像から作り直す
    }
  }
  return null;
}

async function downloadPoster(event: ScrapedEvent): Promise<Buffer> {
  try {
    return await fetchBuffer(event.posterUrl!);
  } catch (caught) {
    if (!event.posterFallbackUrl) throw caught;
    console.warn(`  元画像が取れないので縮小版を使います: ${event.id}`);
    return fetchBuffer(event.posterFallbackUrl);
  }
}

/** 前回の内容をそのまま載せ続けるイベント用。前に作った画像だけを持ってくる */
export async function restoreImages(
  images: EventImage[],
  options: ImageOptions,
): Promise<EventImage[]> {
  const restored: EventImage[] = [];
  for (const image of images) {
    const thumbnail = await restore(image.thumbnail, options);
    const cover = thumbnail ? await restore(image.image, options) : null;
    if (thumbnail && cover) restored.push(image);
  }
  return restored;
}

/** イベント1件ぶんのチラシ画像を出力フォルダに用意する */
export async function prepareImages(
  event: ScrapedEvent,
  options: ImageOptions,
): Promise<ImageResult> {
  const paths = imagePathsFor(event);
  if (!paths) return { images: [], source: 'none' };

  const thumbnail = await restore(paths.thumbnail, options);
  const cover = thumbnail ? await restore(paths.image, options) : null;
  if (thumbnail && cover) return { images: [paths], source: thumbnail };

  const original = sharp(await downloadPoster(event)).rotate();
  await mkdir(dirname(join(options.outDir, paths.thumbnail)), { recursive: true });
  await original
    .clone()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(join(options.outDir, paths.thumbnail));
  await original
    .clone()
    .resize({ width: COVER_WIDTH, withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(join(options.outDir, paths.image));

  return { images: [paths], source: 'downloaded' };
}
