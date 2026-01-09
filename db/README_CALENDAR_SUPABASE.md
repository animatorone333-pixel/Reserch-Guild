# Calendar 行事曆頁面 Supabase 設定指南

## 概述

Calendar 行事曆頁面已經升級為使用 Supabase 作為主要資料儲存，並保留 localStorage 作為 fallback 機制，支援多人即時編輯和同步更新行程表。

## 功能特點

- ✅ **即時同步**：使用 Supabase Realtime 訂閱，多人編輯即時更新
- ✅ **自動備援**：Supabase + localStorage 雙重保障
- ✅ **樂觀更新**：輸入時立即顯示，背景同步到資料庫
- ✅ **狀態指示器**：右上角顯示目前使用的資料來源
- ✅ **自動切換**：若沒有 Supabase 環境變數，自動回退到 localStorage

## 資料表結構

### calendar_notes（行事曆備註）

```sql
- id: BIGSERIAL PRIMARY KEY
- date_key: TEXT UNIQUE（日期鍵值，格式：YYYY-MM-DD）
- note_text: TEXT（備註內容）
- user_id: TEXT（使用者 ID，預留多使用者功能）
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**索引：**
- `idx_calendar_notes_date_key` - 日期鍵值索引
- `idx_calendar_notes_user_id` - 使用者 ID 索引
- `idx_calendar_notes_updated_at` - 更新時間索引

## 設定步驟

### 步驟 1：在 Supabase 建立資料表

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇您的專案
3. 進入 SQL Editor
4. 依序執行以下 SQL 檔案：

```bash
# 1. 建立 calendar_notes 表
cat db/create_calendar_notes_table.sql

# 2. 設定 RLS 政策
cat db/rls_calendar_notes.sql
```

或直接在 SQL Editor 中執行：

```sql
-- 複製 db/create_calendar_notes_table.sql 的內容並執行
-- 接著複製 db/rls_calendar_notes.sql 的內容並執行
```

### 步驟 2：啟用 Realtime

在 Supabase Dashboard：
1. 前往 **Database** → **Replication**
2. 確認 `calendar_notes` 表已加入 `supabase_realtime` publication
3. 如果沒有，點擊表格旁的開關啟用

### 步驟 3：設定環境變數

確保專案根目錄有 `.env.local` 檔案（與 ChatBox、Register 共用）：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> 💡 這些環境變數與其他功能共用，如果已經設定過就不需要重複設定。

### 步驟 4：測試

1. 啟動開發伺服器：
```bash
npm run dev
```

2. 前往 `/calendar` 頁面

3. 檢查右上角的狀態指示器：
   - 🟢 **Supabase**：表示成功連接到 Supabase
   - 🟡 **LocalStorage**：表示使用本地儲存

4. 測試功能：
   - 在任意日期格子輸入行程
   - 開啟多個瀏覽器視窗
   - 在一個視窗編輯，另一個視窗會即時更新
   - 切換月份，備註會自動載入

## 資料流程

### 使用 Supabase 時：

```
用戶輸入 → 本地狀態立即更新（樂觀更新）
          ↓
     同步到 Supabase
          ↓
   Realtime 推送變更
          ↓
  其他用戶即時收到更新
```

### Fallback 模式（LocalStorage）：

```
用戶輸入 → 本地狀態更新
          ↓
   儲存到 localStorage
          ↓
      僅本機可見
```

## 即時協作情境

### 情境 1：多人同時編輯不同日期
- ✅ 互不干擾，各自的變更即時同步
- 使用 `date_key` 作為唯一鍵，確保不衝突

### 情境 2：多人同時編輯同一日期
- ⚠️ 最後寫入者勝出（Last Write Wins）
- Supabase 會以最新的 `updated_at` 為準
- 建議：UI 可增加「正在編輯」指示（未來功能）

### 情境 3：網路斷線
- 本地編輯仍可正常運作（樂觀更新）
- 重新連線後自動同步
- 若同步失敗，會在 Console 顯示錯誤

## 維護與監控

### 查看 Supabase 資料

```sql
-- 查看所有備註
SELECT * FROM calendar_notes ORDER BY date_key;

-- 查看特定月份的備註
SELECT * FROM calendar_notes 
WHERE date_key LIKE '2026-01-%' 
ORDER BY date_key;

-- 查看最近更新的備註
SELECT * FROM calendar_notes 
ORDER BY updated_at DESC 
LIMIT 10;

-- 清除空白備註
DELETE FROM calendar_notes WHERE note_text = '' OR note_text IS NULL;
```

### 偵錯

開啟瀏覽器開發者工具（F12），在 Console 中會看到：

- `✅ 從 Supabase 載入行事曆備註成功` - 成功載入
- `❌ 從 Supabase 載入失敗: ...` - 載入失敗（會自動回退）
- `📡 Calendar notes 變更: ...` - Realtime 收到變更事件
- `❌ 更新 Supabase 備註失敗: ...` - 寫入失敗

### 效能優化建議

1. **定期清理空白備註**：
```sql
DELETE FROM calendar_notes WHERE note_text = '';
```

2. **批次載入**：目前載入所有備註，若資料量大可改為按月載入

3. **防抖動（Debounce）**：快速輸入時減少 API 呼叫
   - 可考慮加入 debounce，延遲 500ms 再寫入

## 常見問題

### Q: 為什麼顯示 🟡 LocalStorage？

A: 可能原因：
1. 缺少環境變數 `NEXT_PUBLIC_SUPABASE_URL` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Supabase 專案暫時無法連線
3. 資料表尚未建立

### Q: 如何遷移現有的 localStorage 資料到 Supabase？

A: 使用以下步驟：

1. 在瀏覽器 Console 執行：
```javascript
// 匯出現有資料
const notes = JSON.parse(localStorage.getItem('calendar_notes_v1') || '{}');
console.log(JSON.stringify(notes, null, 2));
```

2. 在 Supabase SQL Editor 執行：
```sql
-- 批次匯入（根據實際資料調整）
INSERT INTO calendar_notes (date_key, note_text, user_id) VALUES
  ('2026-01-01', '元旦', 'guest'),
  ('2026-01-15', '重要會議', 'guest')
ON CONFLICT (date_key) DO UPDATE SET note_text = EXCLUDED.note_text;
```

### Q: 可以限制特定使用者才能編輯嗎？

A: 可以！修改 `db/rls_calendar_notes.sql`：

```sql
-- 只允許已登入使用者編輯
ALTER POLICY "Allow public update on calendar_notes" 
  ON calendar_notes 
  USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
```

然後在前端整合 Supabase Auth。

### Q: 輸入速度很快時會不會有問題？

A: 目前每次輸入都會觸發 API 呼叫。建議改進方案：

```typescript
// 使用 debounce 優化
import { useCallback } from 'react';
import debounce from 'lodash/debounce';

const debouncedUpdate = useCallback(
  debounce((dateKey: string, value: string) => {
    updateNoteInSupabase(dateKey, value);
  }, 500),
  []
);
```

## 安全性

- ✅ RLS 已啟用，使用公開讀寫政策（適合內部團隊）
- ✅ Anon key 可安全暴露在客戶端
- ⚠️ 若需要嚴格權限控制，請修改 RLS 政策並整合 Supabase Auth

## 效能指標

- **首次載入**：~200-500ms（取決於資料筆數）
- **即時更新延遲**：~50-200ms（Realtime WebSocket）
- **單次寫入**：~100-300ms

## 相關檔案

- [app/calendar/page.tsx](../app/calendar/page.tsx) - 主要元件
- [db/create_calendar_notes_table.sql](create_calendar_notes_table.sql) - 資料表
- [db/rls_calendar_notes.sql](rls_calendar_notes.sql) - RLS 政策

## 未來改進方向

1. **使用者識別**：整合真實使用者 ID
2. **版本歷史**：記錄備註的修改歷史
3. **防抖動**：減少 API 呼叫次數
4. **離線模式**：完整的離線支援和衝突解決
5. **正在編輯指示**：顯示其他使用者正在編輯的日期

## 需要幫助？

如有問題，請檢查：
1. Supabase Dashboard 的 Logs
2. 瀏覽器 Console 的錯誤訊息
3. 環境變數是否正確設定
4. Realtime 是否已啟用
