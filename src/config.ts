/** 取り込み元。京都大学公式サイトのイベント一覧 */
export const SITE_ORIGIN = 'https://www.kyoto-u.ac.jp';
export const LIST_PATH = '/ja/event';

/** 相手のサーバーに負担をかけないための間隔と上限 */
export const REQUEST_INTERVAL_MS = 700;
export const REQUEST_TIMEOUT_MS = 20_000;
export const MAX_LIST_PAGES = 15;

/**
 * 安全装置。サイトの改装などで読み取りが壊れたときに、
 * 中身の欠けたファイルで公開中のものを上書きしないための下限。
 */
export const MIN_EVENTS = 5;
export const MAX_DETAIL_FAILURE_RATIO = 0.2;

/** アプリの一覧用と、詳細・拡大表示用の画像の横幅 */
export const THUMBNAIL_WIDTH = 600;
export const COVER_WIDTH = 1400;

export const USER_AGENT =
  'kyodaihub-events-sync/1.0 (+https://github.com/minakei02/kyodaihub-events)';

/**
 * 京大サイトのタグ → アプリに出す分類の名前。
 * 分類は公式のタグをもとにして、学生に伝わりやすい名前に言い換え、近いものをまとめている。
 * 名前やまとめ方を変えたいときは、ここだけ直す（アプリ側の変更は要らない）。
 */
export const CATEGORY_BY_TAG: Record<string, string> = {
  公開講座: '講座・見学会',
  教育: '講座・見学会',
  研究: '研究・シンポジウム',
  産官学連携: '研究・シンポジウム',
  社会連携: '展示・大学の催し',
  大学の動き: '展示・大学の催し',
  学生支援: '学生生活',
  学生の活動: '学生生活',
  事務連絡: '学生生活',
  国際交流: '国際交流',
  入試: '受験生・高校生向け',
  高大連携: '受験生・高校生向け',
  同窓会: '同窓会・卒業生',
};

/** タグが付いていないイベントの分類。対応表にないタグは、公式のタグの名前をそのまま使う */
export const UNTAGGED_CATEGORY = 'その他';
