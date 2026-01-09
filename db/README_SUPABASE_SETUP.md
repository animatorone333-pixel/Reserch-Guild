# Supabase 完整設定指南

本專案已整合 Supabase 作為後端資料庫，支援三大功能的即時同步。

## 📋 功能總覽

| 功能 | 頁面 | 資料表 | 即時同步 | Fallback | 特殊功能 |
|------|------|--------|----------|----------|----------|
| 聊天室 | `/` | `messages` | ✅ | `/api/chat` + localStorage | - |
| 活動報名 | `/register` | `registrations`, `event_dates` | ✅ | Google Sheets + localStorage | - |
| 行事曆 | `/calendar` | `calendar_notes` | ✅ | localStorage | - |
| 商店 | `/shop` | `shop_items` + Storage | ✅ | Google Sheets + localStorage | 🖼️ 圖片上傳 |
| 首頁公告 | `/` | `announcements` | ✅ | localStorage | - |

## 🚀 快速開始（一次設定全部功能）

### 步驟 1：設定環境變數

在專案根目錄建立 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> 💡 從 Supabase Dashboard → Settings → API 取得這些值

### 步驟 2：建立所有資料表

登入 [Supabase Dashboard](https://app.supabase.com/)，進入 SQL Editor，依序執行：

#### 1. 聊天室 (Messages)
```sql
-- 複製 db/create_messages_table.sql 的內容並執行
```

#### 2. 活動報名 (Registrations & Event Dates)
```sql
-- 複製 db/create_registrations_table.sql 的內容並執行
-- 複製 db/create_event_dates_table.sql 的內容並執行
-- 複製 db/rls_registrations.sql 的內容並執行
```

#### 3. 行事曆 (Calendar Notes)
```sql
-- 複製 db/create_calendar_notes_table.sql 的內容並執行
-- 複製 db/rls_calendar_notes.sql 的內容並執行
```

#### 4. 商店 (Shop Items)
```sql
-- 複製 db/create_shop_items_table.sql 的內容並執行
-- 複製 db/rls_shop_items.sql 的內容並執行
```

**⚠️ 重要：還需要建立 Storage Bucket**

1. 前往 **Storage** → **Create bucket**
2. Name: `shop-images`
3. **Public bucket**: ✅ 必須勾選
4. 設定 Storage 政策（詳見 [storage_setup_shop.md](storage_setup_shop.md)）

#### 5. 首頁公告 (Announcements)
```sql
-- 複製 db/create_announcements_table.sql 的內容並執行
-- 複製 db/rls_announcements.sql 的內容並執行
```

### 步驟 3：啟用 Realtime

在 Supabase Dashboard：
1. 前往 **Database** → **Replication**
2. 確認以下表格已加入 `supabase_realtime` publication：
   - ✅ `messages`
   - ✅ `registrations`
   - ✅ `event_dates`
   - ✅ `calendar_notes`
   - ✅ `shop_items`
   - ✅ `announcements`
### 步驟 4：測試

```bash
npm run dev
```

訪問各頁面並檢查右上角的狀態指示器：
- `/` - 聊天室應顯示 🟢 Supabase（公告板也應顯示 🟢 Supabase）
- `/register` - 報名頁應顯示 🟢 Supabase
- `/calendar` - 行事曆應顯示 🟢 Supabase
- `/shop` - 商店頁應顯示 🟢 Supabase

## 📊 資料表結構速查

### messages（聊天室）
```
id, username, content, avatar, created_at
```

### registrations（報名記錄）
```
id, name, department, event_date, created_at, updated_at
```

### event_dates（活動日期）
```
id, event_date, image_url, display_order, created_at, updated_at
```

### calendar_notes（行事曆備註）
```
id, date_key, note_text, user_id, created_at, updated_at
```

### shop_items（商店商品）
```
id, position, item_name, image_url, user_id, created_at, updated_at
```

### Storage Bucket: shop-images
```
儲存商品圖片，檔名格式：{position}_{timestamp}.{ext}
```

### announcements（首頁公告）
```
id, content, updated_at, updated_by
備註：單一記錄設計（id 固定為 1）
```

## 🔧 常見問題排查

### Q: 所有頁面都顯示 🟡 Fallback 怎麼辦？

**檢查清單：**
1. ✅ `.env.local` 檔案存在且格式正確
2. ✅ 環境變數名稱正確（`NEXT_PUBLIC_` 前綴）
3. ✅ 重啟開發伺服器（`npm run dev`）
4. ✅ Supabase 專案沒有暫停（免費方案會自動暫停）

### Q: 顯示 🟢 但無法寫入資料？

**可能原因：**
1. ❌ RLS 政策未正確設定
2. ❌ Realtime 未啟用
3. ❌ 資料表不存在

**解決方法：**
```sql
-- 檢查表格是否存在
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- 檢查 RLS 是否啟用
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- 檢查政策
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### Q: Realtime 不工作？

1. 前往 Database → Replication
2. 確認表格在 `supabase_realtime` publication 中
3. 檢查 Console 是否有 WebSocket 錯誤
4. 確認瀏覽器未封鎖 WebSocket 連線

### Q: 如何清除測試資料？

```sql
-- 清除聊天記錄
TRUNCATE messages;

-- 清除報名資料
TRUNCATE registrations;

-- 清除活動日期（保留預設值）
DELETE FROM event_dates WHERE id > 3;

-- 清除行事曆空白備註
DELETE FROM calendar_notes WHERE note_text = '' OR note_text IS NULL;
```

## 📈 效能優化建議

### 1. 定期清理舊資料

```sql
-- 刪除 30 天前的聊天記錄
DELETE FROM messages 
WHERE created_at < NOW() - INTERVAL '30 days';

-- 刪除空白的行事曆備註
DELETE FROM calendar_notes 
WHERE note_text = '';
```

### 2. 監控資料庫大小

```sql
-- 查看各表大小
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. 備份重要資料

在 Supabase Dashboard：
- 前往 **Database** → **Backups**
- 啟用自動備份（Pro 方案）
- 或定期手動匯出資料

## 🔒 安全性注意事項

### 目前設定（內部使用）
- ✅ 所有表格使用公開讀寫政策
- ✅ 適合小團隊內部使用
- ⚠️ 任何人都可以讀寫資料

### 如需加強安全性

1. **整合 Supabase Auth**：
```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()
const { data: { user } } = await supabase.auth.getUser()
```

2. **修改 RLS 政策**：
```sql
-- 只允許已登入使用者寫入
CREATE POLICY "Allow authenticated users"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

3. **使用 Row Level Security**：
```sql
-- 只能看到自己的資料
CREATE POLICY "Users see own data"
  ON calendar_notes FOR SELECT
  USING (user_id = auth.uid());
```

## 📚 詳細文件

- [聊天室設定](../README.md#supabase-chat-setup) - 在主 README 中
- [報名頁設定](README_REGISTER_SUPABASE.md) - 詳細的報名功能文件
- [行事曆設定](README_CALENDAR_SUPABASE.md) - 詳細的行事曆文件
- [商店頁設定](README_SHOP_SUPABASE.md) - 詳細的商店功能文件（含圖片上傳）

## 🎯 測試檢查表

使用此檢查表確保所有功能正常運作：

### 聊天室 (`/`)
- [ ] 右上角顯示 🟢 Supabase
- [ ] 可以發送訊息
- [ ] 開啟兩個瀏覽器視窗，訊息即時同步
- [ ] 頭像正確顯示

### 報名頁 (`/register`)
- [ ] 右上角顯示 🟢 Supabase
- [ ] 可以點擊日期卡片報

### 商店 (`/shop`)
- [ ] 右上角顯示 🟢 Supabase
- [ ] 可以上傳圖片到格子
- [ ] 圖片正確顯示
- [ ] 可以輸入商品名稱
- [ ] 開啟兩個視窗，商品即時同步
- [ ] 上傳新圖片時舊圖片自動刪除名
- [ ] 報名資訊正確顯示
- [ ] 可以編輯和刪除報名
- [ ] 開啟兩個視窗，報名即時同步

### 行事曆 (`/calendar`)
- [ ] 右上角顯示 🟢 Supabase
- [ ] 可以在日期格子輸入行程
- [ ] 切換月份，行程正確保留
- [ ] 開啟兩個視窗，行程即時同步
- [ ] 快速輸入時不會卡頓

## 🆘 需要幫助？

1. **查看 Supabase Logs**：Dashboard → Logs → Database/Realtime
2. **檢查瀏覽器 Console**：F12 → Console 查看錯誤訊息
3. **測試網路連線**：確認可以連到 Supabase
4. **重新建立資料表**：DROP TABLE 後重新執行 SQL

## 🌟 進階功能（未來擴展）

### 多使用者帳號系統
整合 Supabase Auth 實現真實的使用者系統

### 通知功能
使用 Supabase Edge Functions 發送通知

### 檔案上傳
使用 Supabase Storage 上傳圖片和檔案

### 資料分析
使用 Supabase 的查詢功能建立儀表板

---

**版本資訊：**
- 最後更新：2026-01-08
- Supabase 版本：最新
- Next.js 版本：15.1.3
