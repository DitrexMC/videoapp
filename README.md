# VideoApp
<p align="center">
身内向けのセルフホスト型ファイルアップローダー / 共有サービスです。
</p>

> [!WARNING]
> **このプロジェクトはAI（Deepseek v4 / Claude Sonnet 4.6）によって生成されたコードを元に構築されています。**
> 本格的なプロダクション用途ではなく、趣味の個人プロジェクトとして公開しているものです。
> コードの品質やセキュリティについて保証はありませんので、参考程度にご覧ください。
> **開発者は、本ソフトウェアの使用によって生じたいかなる損害・データ損失・セキュリティ事故についても一切の責任を負いません。**


## 主な機能

- ログイントークン / セッショントークンによる認証（パスワード不要）
- ファイルの公開/非公開設定（認証なしの共有URL発行が可能）
- 動画・音声ストリーミング再生（HTTP Range対応、シーク再生）
- 動画サムネイル自動生成（ffmpeg）
- 音声ファイルのメタデータ自動抽出（ID3タグ、アートワーク）
- フォルダ管理・グループ管理
- ファイルの有効期限設定
- お知らせ機能（Markdown記事、既読管理、未読バッジ表示）
- 管理画面（ユーザー作成/削除/無効化、ストレージ容量制限、全ファイル管理、ポリシー動的変更）
- ログイントークン再発行（全デバイス強制ログアウト）
- セッション管理（デバイスごとのログイン状態の確認・削除）
- 開発者モード（devmode時は強制リロードボタン表示）
- PWA対応（Service Workerによるオフラインシェル、スタンドアロンインストール）
- ダーク/ライトテーマ切替
- SPA風画面遷移（View Transitions API、ページプリロード）
- ユーザープロフィール設定（ユーザー名・アイコン変更）

## 技術スタック

| 項目 | 使用技術 |
|------|----------|
| ランタイム | Node.js >= 22.0.0 |
| 言語 | TypeScript 5.8 |
| Webフレームワーク | Fastify 5 |
| データベース | SQLite (better-sqlite3) |
| バリデーション | Zod |
| フロントエンド | Vanilla JS（フレームワーク未使用） |
| リバースプロキシ | nginx |

## セットアップ

```bash
npm install
```

`.env.example` を参考に `.env` を作成してください。

```env
APP_HOST=0.0.0.0
APP_PORT=3000
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_LOGIN_TOKEN=your-token-here
```

初回起動時に `BOOTSTRAP_ADMIN_LOGIN_TOKEN` で指定したトークンを使って管理者としてログインできます（再起動後も有効です）。

```bash
npm run dev    # 開発サーバー起動（tsx watch）
npm run build  # TypeScript ビルド
npm start      # ビルド済みサーバー起動
npm test       # 統合テスト実行
```

nginx を使う場合は `nginx/videoapp.conf` を参考に設定してください。大容量アップロード時に `proxy_request_buffering off` が必須です。

## ディレクトリ構成

```
src/
├── app/            # 起動、DI、Fastify 設定
├── modules/
│   ├── identity/       # ログイン、セッション、認証
│   ├── uploads/        # アップロード (init, chunk, complete, direct)
│   ├── files/          # ファイル管理、ダウンロード、ZIP、フォルダ、グループ
│   ├── administration/ # 管理者API
│   ├── news/           # お知らせ機能（記事・既読管理）
│   └── processing/     # バックグラウンドワーカー（結合・プレビュー生成）
├── shared/         # 共通エラー、DB、セキュリティ、ストレージ
└── main.ts
public/             # 静的フロントエンド (Vanilla JS + CSS)
tests/              # 統合テスト
specification/      # 設計仕様書（AI生成のため実装と不整合あり）
```

## API エンドポイント

### 認証系
- `POST /auth/login` - ログイン
- `GET /auth/me` - ユーザー情報 + ストレージ使用量
- `GET /auth/sessions` - セッション一覧
- `DELETE /auth/sessions/:sessionId` - セッション削除
- `PATCH /auth/username` - ユーザー名変更
- `POST /auth/logout` - ログアウト
- `POST /auth/logout_all` - 全デバイスログアウト
- `POST /auth/login-token/rotate` - ログイントークン再発行

### アップロード系
- `POST /upload/init` - チャンクアップロード開始
- `PUT /upload/:uploadId/:index` - チャンク送信
- `POST /upload/complete` - アップロード完了
- `GET /upload/:uploadId/status` - 進捗・処理状況取得
- `DELETE /upload/:uploadId` - キャンセル
- `POST /upload` - 簡易マルチパートアップロード
- `POST /upload/direct/init` + `POST /upload/direct/:uploadId` - ダイレクトアップロード

### ファイル系
- `GET /files` - ファイル一覧
- `GET /files/:id` / `GET /file/:id` - ファイル詳細
- `GET /files/:id/download` - ダウンロード
- `GET /files/:id/stream` - ストリーミング再生（Range対応）
- `GET /files/:id/preview` - プレビュー/サムネイル
- `GET /files/:id/meta` - 音声メタデータ
- `PATCH /files/:id/public` - 公開/非公開切替
- `PATCH /files/:id/expire` - 有効期限設定
- `PATCH /files/:id/rename` - ファイル名変更
- `DELETE /files/:id` - 削除
- `POST /files/zip` - 一括ZIPダウンロード

### フォルダ・グループ系
- `GET /folders` / `POST /folders` - 一覧・作成
- `GET /folders/:id/files` - フォルダ内ファイル
- `PATCH /folders/:id` - リネーム
- `PATCH /folders/:id/visibility` - 公開設定
- `DELETE /folders/:id` - 削除
- `GET /groups` - グループ一覧
- `GET /groups/:id/files` - グループ内ファイル
- `PATCH /groups/:id` - リネーム
- `DELETE /groups/:id` - 削除

### 管理者系（admin ロール必須）
- `GET /admin/users` / `POST /admin/users` - ユーザー一覧・作成
- `DELETE /admin/users/:userId` - ユーザー削除
- `PATCH /admin/users/:userId/disable` / `enable` - 無効化/有効化
- `PATCH /admin/users/:userId/username` - ユーザー名変更
- `PATCH /admin/users/:userId/icon/reset` - アイコンリセット
- `POST /admin/users/:userId/login-token/rotate` - トークン再発行
- `PATCH /admin/users/:userId/storage-limit` / `file-limit` - 容量制限変更
- `GET /admin/users/:userId/sessions` - セッション一覧
- `GET /admin/files` / `GET /admin/files/:id` - 全ファイル閲覧
- `DELETE /admin/files/:id` - ファイル削除
- `PATCH /admin/files/:id/public` / `expire` - 公開・期限の強制変更
- `GET /admin/groups` / `DELETE /admin/groups/:id` - グループ管理
- `GET /admin/policies` / `PATCH /admin/policies` - ポリシー取得・更新

### お知らせ系
- `GET /api/news/articles` - 記事一覧
- `GET /api/news/articles/:slug` - 記事詳細
- `GET /api/news/read-urls` - 既読一覧
- `POST /api/news/read` - 既読にする
- `GET /admin/news` / `POST /admin/news` / `PATCH /admin/news/:slug` / `DELETE /admin/news/:slug` - 記事管理

### その他
- `GET /health/live` / `GET /health/ready` - ヘルスチェック
- `GET /config` - 公開設定・ポリシー値

## 設定可能な主な環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `APP_HOST` | `127.0.0.1` | バインドアドレス |
| `APP_PORT` | `3000` | ポート番号 |
| `LOG_LEVEL` | `info` | ログレベル |
| `DEV_MODE` | `false` | 開発モード切替 |
| `DATA_DIR` | `data` | データディレクトリ |
| `SESSION_TTL_SECONDS` | `2592000` | セッション有効期限（デフォルト30日） |
| `DEFAULT_STORAGE_LIMIT_BYTES` | `50GB` | ユーザーあたり容量制限 |
| `DEFAULT_MAX_FILE_SIZE_BYTES` | `5GB` | 1ファイル最大サイズ |
| `MAX_ZIP_TOTAL_BYTES` | `2GB` | ZIP最大合計サイズ |
| `MAX_ZIP_FILE_COUNT` | `500` | ZIP最大ファイル数 |
| `MAX_CHUNK_CONCURRENCY_PER_USER` | `12` | 同時チャンク送信数制限 |
| `MAX_FINALIZE_JOBS` | `8` | バックグラウンド処理同時実行数 |
| `DEFAULT_FILE_EXPIRY_DAYS` | `null` | デフォルト有効期限（null=無期限） |
| `BOOTSTRAP_ADMIN_USERNAME` | `admin` | 管理者ユーザー名 |
| `BOOTSTRAP_ADMIN_LOGIN_TOKEN` | — | 管理者ログイントークン（**必須**） |

## 注意事項

- このプロジェクトはAIにより大部分が自動生成されています。本番環境での利用は推奨しません。
- ストレージはローカルファイルシステムのみ対応、S3等のクラウドストレージには未対応です。
- ポリシー変更はDBの `service_policies` テーブルで管理され、実行時に動的に反映されます。
- セルフサインアップは未実装です。ユーザーは管理者が手動作成し、ログイントークンを共有する方式です。
- 動画のトランスコード（解像度変換等）は未実装です。ffmpeg はサムネイル抽出のみに使用しています。
- 単一インスタンス想定のため、水平スケーリングには対応していません。
- `specification/` 以下の仕様書はAI生成による初期設計のため、実際の実装と一部不整合があります。実装が正です。
