# VideoApp Backend

Node.js 22 で動作する身内向けファイルアップローダーのバックエンドです。

## セットアップ

1. `npm install`
2. 必要なら `.env` を作成
3. `npm run dev` または `npm start`

初回管理者を作るには、起動前に `BOOTSTRAP_ADMIN_LOGIN_TOKEN` を設定してください。

例:

```env
BOOTSTRAP_ADMIN_LOGIN_TOKEN=change-me
BOOTSTRAP_ADMIN_USERNAME=admin
APP_PORT=3000
```

## 主要スクリプト

- `npm run dev` : 開発サーバー起動
- `npm run build` : TypeScript ビルド
- `npm test` : 統合テスト実行
- `npm start` : ビルド済みサーバー起動

## アーキテクチャ

- `src/app` : 起動、DI、Fastify 設定
- `src/modules/identity` : ログイン、セッション、認証
- `src/modules/uploads` : upload/init, chunk, complete, status
- `src/modules/files` : ファイル詳細、公開設定、ダウンロード、ZIP、フォルダ
- `src/modules/administration` : 管理者API
- `src/modules/processing` : バックグラウンド最終化ワーカー
- `src/shared` : 共通エラー、DB、ポリシー、ストレージ

## 実装済みの主な API

- `/auth/login`
- `/auth/logout`
- `/auth/logout_all`
- `/auth/login-token/rotate`
- `/auth/me`
- `/upload/init`
- `/upload/{uploadId}/{index}`
- `/upload/complete`
- `/upload/{uploadId}/status`
- `/files`
- `/files/{id}`
- `/files/{id}/download`
- `/files/{id}/stream`
- `/files/{id}/preview`
- `/files/zip`
- `/folders`
- `/admin/users`
- `/admin/files/{id}`
- `/admin/policies`

## ストレージ

- DB は SQLite を使用します。
- 実ファイルはローカルストレージへ保存します。
- chunk は `data/uploads`、本体は `data/storage`、preview は `data/previews` に配置されます。

## 補足

- ポリシー変更は DB の `service_policies` を参照して実行時に反映されます。
- `EMBED_WORKER=true` の場合、API プロセス内で最終化ワーカーも起動します。