# Discord MCP Server

Discord Model Context Protocol (MCP) server that provides tools for interacting with Discord channels. This server allows you to send messages, send any type of files (images, videos, audio, documents), retrieve messages, and retrieve media attachments from Discord channels.

## 機能 (Features)

- **メッセージ送信**: Discordチャンネルにテキストメッセージを送信
- **ファイル送信**: Discordチャンネルにあらゆる種類のファイルを送信（画像、動画、音声、文書等）
- **メッセージ取得**: Discordチャンネルからメッセージを取得
- **添付ファイル取得**: Discordチャンネルからあらゆる種類の添付ファイルを取得
- **高度な検索**: 日時範囲、キーワード、作者等でフィルタリング

## インストール (Installation)

### npxを使用した簡単インストール（推奨）

```bash
# パッケージを直接実行（自動インストール）
npx @el-el-san/discord-mcp
```

### Claude Codeでの設定

Claude Codeの設定ファイルに以下を追加:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["--yes", "--prefer-online", "@el-el-san/discord-mcp@latest"],
      "env": {
        "DISCORD_BOT_TOKEN": "${DISCORD_BOT_TOKEN}"
      }
    }
  }
}
```

## セットアップ (Setup)

### 1. Discordボットの作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. "New Application" をクリックして新しいアプリケーションを作成
3. "Bot" セクションに移動して "Add Bot" をクリック
4. Bot Token をコピーして保存

### 2. Bot権限の設定

Bot に以下の権限を付与してください：
- `Send Messages`
- `Read Message History`
- `Attach Files`
- `View Channels`

### 3. プロジェクトのセットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp env.example .env
# .envファイルにDiscord Bot Tokenを設定

# TypeScriptのコンパイル
npm run build

# サーバーの起動
npm start
```

### 4. 環境変数

`.env` ファイルを作成し、以下の環境変数を設定：

```
DISCORD_BOT_TOKEN=your_discord_bot_token_here
```

## 使用可能なツール (Available Tools)

### discord_send_message
Discordチャンネルにテキストメッセージを送信します。

パラメータ:
- `channel_id` (string): Discord チャンネル ID
- `message` (string): 送信するメッセージ内容

### discord_send_file
Discordチャンネルにあらゆる種類のファイルを送信します（画像、動画、音声、文書等）。

パラメータ:
- `channel_id` (string): Discord チャンネル ID  
- `file_path` (string): 送信するファイルのローカルパス
- `message` (string, optional): ファイルに添付するメッセージ
- `filename` (string, optional): カスタムファイル名（指定しない場合は元のファイル名を使用）
- `spoiler` (boolean, optional): スポイラー表示にする場合はtrue

### discord_get_messages
Discordチャンネルからメッセージを取得します。

パラメータ:
- `channel_id` (string): Discord チャンネル ID
- `limit` (number, optional): 取得するメッセージ数 (デフォルト: 10, 最大: 100)

### discord_get_attachments
Discordチャンネルからあらゆる種類の添付ファイルを取得します（画像、動画、音声、文書等）。

パラメータ:
- `channel_id` (string): Discord チャンネル ID
- `limit` (number, optional): 検索するメッセージ数 (デフォルト: 50, 最大: 100)
- `content_type_filter` (string, optional): コンテンツタイプでフィルタ（例: "image/", "video/", "audio/", "application/"）

### discord_get_messages_advanced
高度な検索機能を使用してメッセージを取得します。日時範囲指定、キーワード検索、ページネーションに対応。

パラメータ:
- `channel_id` (string): Discord チャンネル ID
- `limit` (number, optional): 取得するメッセージ数 (デフォルト: 50, 最大: 100)
- `before` (string, optional): 指定したメッセージIDより前のメッセージを取得
- `after` (string, optional): 指定したメッセージIDより後のメッセージを取得
- `start_date` (string, optional): 開始日時 (ISO形式, 例: 2024-01-01T00:00:00Z)
- `end_date` (string, optional): 終了日時 (ISO形式, 例: 2024-12-31T23:59:59Z)
- `keyword` (string, optional): メッセージ内容で検索するキーワード
- `author` (string, optional): 特定ユーザー名またはIDでフィルタ
- `has_attachments` (boolean, optional): 添付ファイル付きメッセージのみ取得

## 開発 (Development)

```bash
# 開発モードで起動
npm run dev

# TypeScriptコンパイル
npm run build
```

## 手動インストール（開発者向け）

### MCP サーバーの設定

1. プロジェクトをクローン・ビルド:
```bash
git clone https://github.com/el-el-san/discord-mcp.git
cd discord-mcp
npm install
npm run build
```

2. Claude Code の設定ファイルに以下を追加:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/path/to/discord-mcp/build/index.js"],
      "env": {
        "DISCORD_BOT_TOKEN": "your_discord_bot_token_here"
      }
    }
  }
}
```

3. Claude Code を再起動

### 使用例

Claude Code で以下のようにDiscordツールを使用できます:

```
チャンネル ID 123456789 に "Hello, World!" というメッセージを送信して
```

```
チャンネル ID 123456789 から最新の10件のメッセージを取得して
```

```
/path/to/image.png をチャンネル ID 123456789 に送信して
```

```
/path/to/video.mp4 をチャンネル ID 123456789 に "動画ファイル" というメッセージと一緒に送信して
```

```
チャンネル ID 123456789 から動画ファイルを全て取得して
```

**高度な検索の例:**

```
チャンネル ID 123456789 から2024年1月のメッセージを取得して
```

```
チャンネル ID 123456789 から "error" というキーワードを含むメッセージを検索して
```

```
チャンネル ID 123456789 から特定ユーザー "username" のメッセージだけを取得して
```

## 注意事項 (Notes)

- Discord Bot Token は機密情報です。`.env` ファイルを git にコミットしないでください
- チャンネル ID を取得するには、Discord で開発者モードを有効にし、チャンネルを右クリックして "Copy ID" を選択してください
- Bot がチャンネルにアクセスできるよう、適切な権限が設定されていることを確認してください
- Claude Code の設定ファイルのパスは絶対パスで指定してください
