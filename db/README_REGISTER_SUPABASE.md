# Register 頁面 Supabase 設定指南

## 概述

Register 頁面已經升級為使用 Supabase 作為主要資料儲存，並保留 Google Sheets API 作為 fallback 機制。

## 功能特點

- ✅ **即時更新**：使用 Supabase Realtime 訂閱資料變更
- ✅ **雙重備援**：Supabase + Google Sheets + localStorage
- ✅ **自動切換**：若沒有 Supabase 環境變數，自動回退到 Google Sheets
- ✅ **狀態指示器**：右上角顯示目前使用的資料來源（🟢 Supabase 或 🟡 Fallback）

## 資料表結構

### 1. registrations（報名資料）
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
4. 依序執行以下 SQL 檔案：

```bash
# 1. 建立 registrations 表
cat db/create_registrations_table.sql

# 2. 建立 event_dates 表
cat db/create_event_dates_table.sql

# 3. 設定 RLS 政策
cat db/rls_registrations.sql
```

### 步驟 2：啟用 Realtime

在 Supabase Dashboard：
1. 前往 **Database** → **Replication**
2. 確認 `registrations` 和 `event_dates` 表已加入 `supabase_realtime` publication
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
   - 🟡 **Fallback**：表示使用 Google Sheets API

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

### Fallback 模式時：

```
用戶操作 → /api/sheet → Google Sheets
                ↓
         輪詢（8 秒）
                ↓
         更新 UI
```

## 維護與監控

### 查看 Supabase 資料

```sql
-- 查看所有報名
SELECT * FROM registrations ORDER BY created_at DESC;

-- 查看特定日期的報名
SELECT * FROM registrations WHERE event_date = '10/13';

-- 查看活動日期設定
SELECT * FROM event_dates ORDER BY display_order;
```

### 偵錯

開啟瀏覽器開發者工具（F12），在 Console 中會看到：

- `✅ 從 Supabase 載入資料成功` - 成功載入
- `❌ 從 Supabase 載入失敗: ...` - 載入失敗（會自動回退）
- `📡 Registrations 變更: ...` - Realtime 收到變更事件
- `📡 Event dates 變更: ...` - 日期資料變更事件

## 常見問題

### Q: 為什麼顯示 🟡 Fallback？

A: 可能原因：
1. 缺少環境變數 `NEXT_PUBLIC_SUPABASE_URL` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Supabase 專案暫時無法連線
3. 資料表尚未建立

### Q: 如何遷移現有的 Google Sheets 資料到 Supabase？

A: 執行以下步驟：
1. 從 `/api/sheet` 匯出現有資料
2. 使用 Supabase Dashboard 的 Table Editor 匯入
3. 或使用 SQL INSERT 語句批次匯入

### Q: 可以同時保留 Google Sheets 嗎？

A: 可以！程式碼設計為：
- 有 Supabase 環境變數 → 使用 Supabase
- 沒有 → 自動回退到 Google Sheets
- 兩者都保留可提供額外的備援機制

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
- [app/api/sheet/route.ts](../app/api/sheet/route.ts) - Fallback API

## 需要幫助？

如有問題，請檢查：
1. Supabase Dashboard 的 Logs
2. 瀏覽器 Console 的錯誤訊息
3. 環境變數是否正確設定
