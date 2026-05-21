# VideoApp

> **このプロジェクトはAI（GitHub Copilot / Claude）によって生成されたコードを元に構築されています。**
> 本格的なプロダクション用途ではなく、趣味の個人プロジェクトとして公開しているものです。
> コードの品質やセキュリティについて保証はありませんので、参考程度にご覧ください。

身内向けのセルフホスト型ファイルアップローダー / 共有サービスです。

## 主な機能

- 最大5GBまでのファイルアップロード（チャンク分割・レジューム対応）
- ログイントークン / セッショントークンによる認証
- ファイルの公開/非公開設定
- 管理画面（ユーザー管理、ストレージ容量制限、ポリシー設定）
- 動画サムネイル自動生成（ffmpeg）
- 音声ファイルのメタデータ表示
- ZIP一括ダウンロード
- フォルダ管理
- PWA対応（Service Workerによるオフラインシェル）
- ダーク/ライトテーマ切替

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
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_LOGIN_TOKEN=your-token-here
APP_PORT=3000
```

初回起動時に `BOOTSTRAP_ADMIN_LOGIN_TOKEN` で指定したトークンを使って管理者としてログインできます。

```bash
npm run dev    # 開発サーバー起動
npm run build  # TypeScript ビルド
npm start      # ビルド済みサーバー起動
npm test       # 統合テスト実行
```

## ディレクトリ構成

```
src/
├── app/            # 起動、DI、Fastify 設定
├── modules/
│   ├── identity/       # ログイン、セッション、認証
│   ├── uploads/        # アップロード (init, chunk, complete)
│   ├── files/          # ファイル管理、ダウンロード、ZIP
│   ├── administration/ # 管理者API
│   ├── news/           # お知らせ機能
│   └── processing/     # バックグラウンド最終化ワーカー
├── shared/         # 共通エラー、DB、セキュリティ、ストレージ
└── main.ts
public/             # 静的フロントエンド (Vanilla JS + CSS)
tests/              # 統合テスト
specification/      # 設計仕様書
```

## API エンドポイント (一部)

- `POST /auth/login` - ログイン
- `POST /auth/logout` / `POST /auth/logout_all` - ログアウト
- `POST /upload/init` - アップロード開始
- `PUT /upload/{uploadId}/{index}` - チャンク送信
- `POST /upload/complete` - アップロード完了
- `GET /files` - ファイル一覧
- `GET /files/{id}/download` - ダウンロード
- `GET /files/{id}/stream` - ストリーミング再生 (Range対応)
- `GET /files/{id}/preview` - プレビュー/サムネイル
- `POST /files/zip` - 一括ZIPダウンロード
- `GET /admin/users` - ユーザー管理
- `GET /admin/policies` - ポリシー設定

## 注意事項

- このプロジェクトはAIにより大部分が自動生成されています。本番環境での利用は推奨しません。
- ストレージはローカルファイルシステムのみ対応、S3等のクラウドストレージには未対応です。
- ポリシー変更はDBの `service_policies` テーブルで管理され、実行時に動的に反映されます。
