# 部署與監控指南

本檔整理針對本專案（Next.js + Supabase）在生產環境部署與監控的建議與示例設定。

**重點快速導覽**
- 建議部署平台：Vercel（與 Next.js 相容性最佳）或任何支援 Node.js 的雲端平台
- 即時資料：使用 Supabase Realtime（已完成整合）
- 設定監控：Sentry（錯誤/例外）、Vercel Insights（部署/效能）、Supabase logs（DB 活動）

---

## 必要環境變數
在部署環境（例如 Vercel、Netlify 或自建 VM）設定下列環境變數：

- `NEXT_PUBLIC_SUPABASE_URL` — 你的 Supabase 專案 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 公開 anon key（客戶端使用）

提示：Service Role Key（`SUPABASE_SERVICE_ROLE_KEY`）切勿放在 client 端或公開 repo；僅在安全的 server-side 或 CI secrets 使用。

---

## Supabase（DB）設定
1. 在 Supabase SQL Editor 執行 `db/create_messages_table.sql` 建立 `public.messages` 表。
2. 根據需求執行 `db/rls_policies.sql`：
   - 若允許匿名發文：啟用 `allow_public_insert`（風險：任何拿到 anon key 的人都能寫入）。
   - 若只允許註冊用戶發文：使用 `allow_insert_auth_users` 並要求使用者透過 Supabase Auth 登入。
3. 在 Supabase Dashboard → Realtime → Publications，確保 `public.messages` 已被包含。
4. 建議：設定自動備份（Supabase 提供 snapshot/backup 功能）與定期匯出重要資料。

---

## 部署到 Vercel（快速步驟）
1. 登入 Vercel，選擇 "Import Project" -> 連結你的 GitHub repository。Vercel 會自動偵測 Next.js。
2. 在 Vercel 專案 Settings -> Environment Variables，新增 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
3. 部署分支（通常 `main`）後，Vercel 會自動 build 與 publish。

若你希望透過 GitHub Actions 自動 build（並保留 Vercel 的 Git 觸發）也可，以下 CI 範例會在 push 時執行 build 檢查。

---

## GitHub Actions（CI 範例）
檔案：`.github/workflows/ci.yml`（範例已加入 repo）
工作流程說明：在 `push`/`pull_request` 時安裝相依套件、執行 `npm run build`，以避免壞的提交進入 main。

要真正自動部署到 Vercel，可在 Vercel UI 啟用 Git 整合，或在 CI 使用 Vercel Action（需 `VERCEL_TOKEN`）來觸發部署。

---

## 監控與告警建議
- 錯誤追蹤：整合 Sentry（`@sentry/nextjs`）來收集例外、前端錯誤與來源堆疊。
  - 設置 Sentry DSN 到 `SENTRY_DSN`（在 Vercel 的環境變數）
  - 在 Sentry 中建立告警規則（錯誤率、回溯次數、特定訊息）並通知 Slack 或 Email。

- 性能 / 指標：使用 Vercel Insights（部署延遲、頁面 SSR 時間、TBT、LCP）或外部 APM（如 Datadog）。

- 日誌與 DB 活動：使用 Supabase 的 SQL logs 與 Realtime event logs；另可在 Supabase 中啟用 slow query logging。

- Uptime 檢查：建立對根路由（`/`）或健康檢查 endpoint（例如 `/api/health`）的外部監控（UptimeRobot、Pingdom），並設定 HTTP 200 與回應時間閾值。

---

## 安全與容量
- 限流：對公開 API（如聊天室）實施速率限制（或在 Cloudflare/edge 使用速率限制），避免被濫用。
- 金鑰管理：不要在 repo 裡提交任何 secret；只在平台的 Secret/Environment 上設定。
- DB 備份：定期匯出資料、啟用 Supabase 提供的備份機制。
- 監控成本：Realtime 訂閱量、寫入頻率會影響 Supabase 費用，請設定合理的 retention 及備援策略。

---

## 簡短故障排查清單
- 無法連線 Supabase：檢查 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正確、專案是否啟用 Realtime 與 publications。
- 訂閱沒有收到事件：確保 `public.messages` 已加入 Realtime publications 且有 INSERT 政策允許。
- 部署失敗：檢查 CI log（`npm run build` 錯誤）、Node、Next.js 版本相容性。

---

## 可選進階（未實作於 repo）
- Sentry SDK 整合示例（`@sentry/nextjs`）與 source maps 上傳。
- 使用 Cloudflare 或 Fastly 做 CDN 與速率限制。
- 使用 Prometheus + Grafana (需自建或透過第三方) 收集自定義 metrics。

---

如果你要我把其中任何一項（例如 Sentry 整合、health endpoint、或把 CI 延伸為自動部署到 Vercel）實作到 repo，請告訴我你想先做哪個，我就開始執行。
