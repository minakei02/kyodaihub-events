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

/** アプリ（京大ポケット）のイベントのカテゴリ */
export type AppCategory =
  | '学ぶ・講座'
  | '研究・サイエンス'
  | '見る・体験する'
  | '進学・大学を知る'
  | 'キャリア・ビジネス・社会実装'
  | '交流・参加する';

/** 京大サイトのタグ → アプリのカテゴリ。振り分けを変えたいときはここだけ直す */
export const CATEGORY_BY_TAG: Record<string, AppCategory> = {
  入試: '進学・大学を知る',
  高大連携: '進学・大学を知る',
  公開講座: '学ぶ・講座',
  教育: '学ぶ・講座',
  研究: '研究・サイエンス',
  社会連携: '見る・体験する',
  大学の動き: '見る・体験する',
  産官学連携: 'キャリア・ビジネス・社会実装',
  学生支援: 'キャリア・ビジネス・社会実装',
  国際交流: '交流・参加する',
  同窓会: '交流・参加する',
  学生の活動: '交流・参加する',
  事務連絡: '交流・参加する',
};

/** 対応表にないタグが出てきたときのカテゴリ */
export const FALLBACK_CATEGORY: AppCategory = '見る・体験する';
