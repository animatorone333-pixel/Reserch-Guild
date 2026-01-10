# Register 頁面 Supabase 設定指南

## 概述

Register 頁面已經升級為使用 Supabase 作為資料儲存，並且需要 Supabase 才能使用（不再使用 Google Sheets fallback）。

## 功能特點

- ✅ **即時更新**：使用 Supabase Realtime 訂閱資料變更
- ✅ **狀態指示器**：右上角顯示目前狀態（🟢 Supabase 或 🔴 Supabase 未設定）

## 資料表結構

### 1. 報名資料表（`registrations` 或 `register`）
```sql
- id: BIGSERIAL PRIMARY KEY
- name: TEXT（姓名）
- department: TEXT（部門）
- event_date: TEXT（活動日期，格式：M/D）
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### 2. event_dates（活動日期）
```sql
- id: BIGSERIAL PRIMARY KEY
- event_date: TEXT（日期，格式：M/D）
- image_url: TEXT（背景圖片）
- display_order: INT（顯示順序）
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

## 設定步驟

### 步驟 1：在 Supabase 建立資料表

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇您的專案
3. 進入 SQL Editor
4. 依序執行以下 SQL 檔案（擇一方案）：

```bash
# A) 使用 `registrations`（建議，跟 repo SQL 一致）
cat db/create_registrations_table.sql
cat db/create_event_dates_table.sql
cat db/rls_registrations.sql

# B) 使用 `register`（你目前的做法）
# 1) 確保 event_dates 存在
cat db/create_event_dates_table.sql
# 2) 套用 `register` + `event_dates` 的 RLS / Realtime 設定
cat db/rls_register.sql
```

### 步驟 2：啟用 Realtime

在 Supabase Dashboard：
1. 前往 **Database** → **Replication**
2. 確認報名表（`registrations` 或 `register`）以及 `event_dates` 已加入 `supabase_realtime` publication
3. 如果沒有，點擊表格旁的開關啟用

### 步驟 3：設定環境變數

確保專案根目錄有 `.env.local` 檔案（或在 Vercel/部署平台設定）：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> 💡 這些環境變數與 ChatBox 共用，如果 ChatBox 已經可以運作，就不需要重複設定。

### 步驟 4：測試

1. 啟動開發伺服器：
```bash
npm run dev
```

2. 前往 `/register` 頁面

3. 檢查右上角的狀態指示器：
   - 🟢 **Supabase**：表示成功連接到 Supabase
       - 🔴 **Supabase 未設定**：表示缺少環境變數，註冊功能會停用

4. 測試功能：
   - 點擊日期卡片進行報名
   - 編輯已報名的資訊
   - 刪除報名
   - 開啟多個瀏覽器視窗測試即時同步

## 資料流程

### 使用 Supabase 時：

```
用戶操作 → Supabase API → 資料庫
                ↓
         Realtime 訂閱
                ↓
         自動更新 UI
```

（已移除 Google Sheets fallback 流程）

## 維護與監控

### 查看 Supabase 資料

```sql
-- 查看所有報名（依你的表名擇一）
SELECT * FROM registrations ORDER BY created_at DESC;
-- or
SELECT * FROM register ORDER BY created_at DESC;

-- 查看特定日期的報名（依你的表名擇一）
SELECT * FROM registrations WHERE event_date = '10/13';
-- or
SELECT * FROM register WHERE event_date = '10/13';

-- 查看活動日期設定
SELECT * FROM event_dates ORDER BY display_order;
```

### 偵錯

開啟瀏覽器開發者工具（F12），在 Console 中會看到：

- `✅ 從 Supabase 載入資料成功` - 成功載入
- `❌ 從 Supabase 載入失敗: ...` - 載入失敗（會顯示錯誤提示並停用註冊）
- `📡 Registrations 變更: ...` - Realtime 收到變更事件
- `📡 Event dates 變更: ...` - 日期資料變更事件

## 常見問題

### Q: 為什麼顯示 🔴 Supabase 未設定？

A: 可能原因：
1. 缺少環境變數 `NEXT_PUBLIC_SUPABASE_URL` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. 部署平台（例如 Vercel）未設定或未重新部署

### Q: 如何遷移現有的 Google Sheets 資料到 Supabase？

A: 執行以下步驟：
1. 從 `/api/sheet` 匯出現有資料
2. 使用 Supabase Dashboard 的 Table Editor 匯入
3. 或使用 SQL INSERT 語句批次匯入

### Q: 可以同時保留 Google Sheets 嗎？

A: 註冊頁目前已改為 Supabase-only；若要保留 Google Sheets 備援，需要重新加入 `/api/sheet` 流程與前端 fallback 邏輯。

## 效能優化

- Supabase 使用 WebSocket 連接，比 Google Sheets 的輪詢更即時
- 減少 API 呼叫次數，降低配額使用
- localStorage 快取確保離線時仍可顯示資料

## 安全性

- RLS 政策已設定為允許公開讀寫（適合內部使用）
- 如需限制存取，修改 `db/rls_registrations.sql`
- Anon key 可安全暴露在客戶端（已在 Supabase 設計中考慮）

## 相關檔案

- [app/register/page.tsx](../app/register/page.tsx) - 主要元件
- [db/create_registrations_table.sql](create_registrations_table.sql) - 報名表
- [db/create_event_dates_table.sql](create_event_dates_table.sql) - 日期表
- [db/rls_registrations.sql](rls_registrations.sql) - RLS 政策
（註冊頁已不再使用 `/api/sheet` 作為資料來源）

## 需要幫助？

如有問題，請檢查：
1. Supabase Dashboard 的 Logs
2. 瀏覽器 Console 的錯誤訊息
3. 環境變數是否正確設定
