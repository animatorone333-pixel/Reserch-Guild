# Copilot / AI Agent 指令（專案導覽、重點與範例）

這份檔案幫助 AI 編碼代理快速理解並在本專案中高效工作。僅包含可從程式碼中發現的、非推測性的實作細節與範例。

- **專案類型**：Next.js (App Router)，主要 React + TypeScript 前端，部分 Server API route（在 `app/api/*`）。
- **主要目的**：提供一個含即時/回退機制的簡易聊天室，支援 Supabase Realtime（若有環境變數）或回退到本地 API（`/api/chat`）。

**快速啟動**
- 開發：`npm run dev`（`next dev --turbopack`）
- 建置：`npm run build`，啟動：`npm run start`

**重要環境變數**
- `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`：若存在則 `app/components/ChatBox.tsx` 會使用 Supabase；否則使用內建 API `app/api/chat/route.ts`。
- `SENTRY_DSN`（可選）：若在瀏覽器環境有設定，client 端會載入 [sentry.client.config.js](sentry.client.config.js)；server 端有 [sentry.server.config.js](sentry.server.config.js)。

**資料與 DB**
- 本地回退儲存在 `data/chat-messages.json`（由 `app/api/chat/route.ts` 讀寫）。
- 若使用 Supabase，參考 SQL: [db/create_messages_table.sql](db/create_messages_table.sql)；README 中亦說明 RLS 與 Realtime 的設定。

**關鍵檔案與模式（會被頻繁修改或參考）**
- 聊天 API（回退）：[app/api/chat/route.ts](app/api/chat/route.ts#L1)
  - GET 會回傳 `data/chat-messages.json`。
  - POST 將訊息加到檔案（最多保留最近 200 則）。
- 聊天元件：`app/components/ChatBox.tsx` —
  - 若有 Supabase env 則會使用 `createClient` 並訂閱 `public:messages` 頻道。
  - 會在沒有 Supabase 的情況下呼叫 `/api/chat`。
  - 本機訪客身分使用 localStorage key `chatbox_guest_identity_v1`。
  - 當使用者點擊頭像會呼叫 `onAvatarClick`（若父元件傳入）。
- 使用者驗證工具：`app/utils/auth.ts` —
  - `getValidUser()` 檢查並回傳 localStorage 的 `mygame_loggedIn` / `mygame_user`。
  - `normalizeAvatarUrl()` 處理 data/https/相對路徑。
- 全域佈局與 Sentry client 初始化：[app/layout.tsx](app/layout.tsx#L1)

**專案慣例與風格要點（僅限可觀察到的）**
- 採用 Next.js App Router（`app/`）與 Server/Client 分離：需注意 `"use client"` 在元件頂端。
- 元件若使用 DOM 或 window、localStorage、ReactDOM.createPortal 等，會以 client component 標記（參見 `ChatBox.tsx`）。
- ChatBox 將 ProfileModal 的呈現移出元件，parent 負責顯示 modal（從程式碼註解可見）。
- 儲存層：在沒有 Supabase 時採用檔案儲存（非資料庫），操作受限於 serverless/權限，因此修改 `app/api/chat/route.ts` 時需小心檔案路徑與 JSON 序列化。

**整合點與注意事項（對 AI agent 很重要）**
- 若修改即時訂閱或 Supabase 相關邏輯，檢查 `app/components/ChatBox.tsx` 中的 `supabase.channel('public:messages')` 及 unsubscribe 實作。
- 若變更訊息格式，同時更新 `data/chat-messages.json` 讀寫邏輯與 `app/api/chat/route.ts` 的型別檢查。
- 若新增 env 變數或秘密鍵，更新 README 並確保不會把機密推上 Git。

**例子：要新增一個欄位到 message**
1. 更新 `app/api/chat/route.ts` 的 `ChatMessage` 型別和 POST/GET 處理。
2. 更新 `app/components/ChatBox.tsx` 的 mapping 與前端展示。
3. 若使用 Supabase，同步更新資料表 SQL（`db/create_messages_table.sql`）並確認 Realtime publication。

若內容有誤或需要加入更多檔案參考，請告訴我想補充的區塊或你最想讓 AI 代理先熟悉的工作流程。
