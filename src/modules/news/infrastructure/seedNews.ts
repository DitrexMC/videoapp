import type Database from "better-sqlite3";
import { generateId } from "../../../shared/domain/id.js";

interface SeedArticle {
  slug: string;
  title: string;
  subtitle: string;
  type: "news" | "update" | "guide" | "note" | "danger";
  date: string;
  tags: string;
  image: string;
  content: string;
}

const defaultArticles: SeedArticle[] = [
  {
    slug: "videoapp-launch",
    title: "videoapp サービス開始のお知らせ",
    subtitle: "プライベートファイルストレージサービス videoapp の提供を開始しました。",
    type: "news",
    date: "2026-05-09",
    tags: "新機能, リリース",
    image: "",
    content: `# videoapp サービス開始のお知らせ

videoapp のサービスを正式に開始しました。

## 主な機能

- **チャンクアップロード** — 大容量ファイルを安定転送（最大5GB）
- **URL即時共有** — アップロード後すぐにURLを発行
- **期限付きストレージ** — 保存期間を自由に設定、期限後は自動削除
- **公開/非公開設定** — ファイルごとに制御可能
- **ZIPダウンロード** — 複数ファイルをまとめてダウンロード
- **フォルダ機能** — 複数ファイルをまとめてアップロード
- **管理者機能** — アップロード状況の監視と不適切なコンテンツの削除
- **セキュリティ対策** — ユーザー認証とアクセス制御で安全に利用可能
- **レスポンシブデザイン** — PC・スマホ両対応の快適なUI
- **PWA対応** — ユーザー体験の向上が実現
- **お知らせ機能** — 重要な情報をユーザーに直接伝達

## 使い方

1. アップロードページへ移動
2. ファイルをドラッグ&ドロップ
3. 期限と公開設定を選んでアップロード
4. 生成されたURLをコピーして共有

## 今後の予定

継続的に機能改善・バグ修正を行っていきます。ご意見やご要望があればお気軽にどうぞ。
`,
  },
  {
    slug: "chunk-upload",
    title: "チャンクアップロード機能を実装しました",
    subtitle: "最大5GBまでの大容量ファイルを安定してアップロードできるようになりました。",
    type: "update",
    date: "2026-05-09",
    tags: "アップロード, 改善",
    image: "",
    content: `## 概要

チャンクアップロード機能を正式に実装しました。従来の単一リクエストによるアップロードに比べ、大容量ファイルの転送が格段に安定しました。

## 変更内容

- **最大ファイルサイズ**: 5GB まで対応
- **チャンクサイズ**: デフォルト10MB（5〜50MBの範囲で調整可能）
- **リアルタイム進捗**: アップロード速度・残り時間・進捗バーをリアルタイム表示
- **エラー時の再試行**: チャンク単位でリトライするため、中断からの復旧が容易

## 使い方

アップロードページで通常通りファイルを選択するだけです。大容量ファイルは自動的にチャンク転送されます。

## 注意事項

- アップロード中はブラウザタブを閉じないでください
- 長時間のアップロードではセッションが切れる場合があります（再ログインが必要）
`,
  },
  {
    slug: "user-reset",
    title: "以前のユーザーデータについて",
    subtitle: "以前のユーザーデータの引き続きに関する重要なお知らせです。",
    type: "danger",
    date: "2026-05-09",
    tags: "ユーザー, データ",
    image: "",
    content: `## 概要

以前のユーザーデータの取り扱いについて重要なお知らせがあります。

## 内容

今回のサービス正式リリースに伴い、これまでのアップロード履歴やファイル、ユーザー情報は現在のサービスには引き継がれません。

そのため、以前のデータにアクセスすることはできなくなります。
新しいサービスをご利用いただく場合は、新たにアカウント申請を行い、必要なファイルを再アップロードしていただく必要があります。

運営上の都合によりご不便をおかけし申し訳ありませんが、何卒ご理解いただけますようお願いいたします。

## 注意事項

- サービスの利用継続には、アカウントの再申請が必要です。
- アカウント申請はDiscordより受け付けております。
`,
  },
];

export function seedDefaultNewsArticles(connection: Database.Database): void {
  const existing = connection
    .prepare("SELECT 1 FROM news_articles LIMIT 1")
    .get();

  if (existing) {
    return;
  }

  const now = new Date().toISOString();
  const insert = connection.prepare(
    `INSERT INTO news_articles (id, slug, title, subtitle, type, date, tags, image, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const seedMany = connection.transaction(() => {
    for (const article of defaultArticles) {
      insert.run(
        generateId(),
        article.slug,
        article.title,
        article.subtitle,
        article.type,
        article.date,
        article.tags,
        article.image,
        article.content,
        now,
        now,
      );
    }
  });

  seedMany();
}
