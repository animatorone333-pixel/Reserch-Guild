# 首頁公告快速設定指南

## ⚠️ 重要：修正 Supabase API Key

您的 `.env.local` 中的 API key 格式不正確。請依照以下步驟修正：

### 1. 取得正確的 API Key

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 點擊左側選單的 **Settings** ⚙️
4. 點擊 **API**
5. 在 **Project API keys** 區域找到 **anon / public** key
6. 複製完整的 key（應該是 `eyJ` 開頭的長字串，約 200+ 字元）

### 2. 更新 .env.local

編輯 `.env.local` 檔案：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://jireuckoxfirvzjixrjp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...完整的key（約200+字元）
```

⚠️ **注意**：
- 正確的 key 是 `eyJ` 開頭，**不是** `ssb_publishable_` 開頭
- 完整的 key 非常長（200+ 字元），請確保複製完整

---

## 📋 設定步驟

### 步驟 1: 修正 API Key（必做）

依照上方指引更新 `.env.local`

### 步驟 2: 在 Supabase 執行 SQL

前往 Supabase Dashboard → **SQL Editor**，依序執行：

#### 2.1 建立資料表

複製並執行 [db/create_announcements_table.sql](../db/create_announcements_table.sql) 的內容

#### 2.2 設定 RLS 政策

複製並執行 [db/rls_announcements.sql](../db/rls_announcements.sql) 的內容

#### 2.3 啟用 Realtime（建表 SQL 已包含，也可手動確認）

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
```

或在 Dashboard：
- **Database** → **Replication**
- 勾選 `announcements`
- 點擊 **Save**

### 步驟 3: 重啟開發伺服器

```bash
# 停止當前伺服器（Ctrl+C）
# 重新啟動
npm run dev
```

### 步驟 4: 測試功能

開啟瀏覽器訪問 http://localhost:3000

檢查公告板右上角的狀態指示：
- 🟢 **Supabase**：設定成功！
- 🟡 **LocalStorage**：仍在降級模式，請檢查設定

---

## 🎯 管理公告的方法

### 方法 1: 在首頁直接編輯（最簡單）

1. 開啟首頁
2. 在公告板直接輸入內容
3. 自動儲存並即時同步

### 方法 2: 使用管理腳本

開啟終端（開發伺服器需在運行中）：

```bash
# 讀取當前公告
node scripts/manage-announcements.js get

# 更新公告
node scripts/manage-announcements.js update "💌最新公告
🔸下次桌遊將在1/15舉行!
🔸歡迎推薦遊戲品項!"
```

### 方法 3: 使用 API

```bash
# 讀取
curl http://localhost:3000/api/announcements

# 更新
curl -X POST http://localhost:3000/api/announcements \
  -H "Content-Type: application/json" \
  -d '{"content": "新公告", "updatedBy": "admin"}'
```

### 方法 4: Supabase Dashboard

1. **Table Editor** → `announcements`
2. 編輯 `id=1` 的記錄
3. 修改 `content` 欄位並儲存

---

## ✅ 驗證清單

設定完成後，確認以下項目：

- [ ] `.env.local` 的 API key 是 `eyJ` 開頭（約 200+ 字元）
- [ ] Supabase 的 `announcements` 資料表已建立
- [ ] RLS 政策已設定（允許讀取和更新）
- [ ] Realtime 已啟用
- [ ] 開發伺服器已重啟
- [ ] 首頁狀態顯示 🟢 Supabase（不是 🟡 LocalStorage）
- [ ] 可以在首頁編輯公告
- [ ] 開啟兩個瀏覽器視窗，修改會即時同步

---

## 🔍 疑難排解

### 問題：狀態顯示 🟡 LocalStorage

**原因**：Supabase 連線失敗

**解決**：
1. 檢查 API key 格式（必須是 `eyJ` 開頭）
2. 檢查 Supabase 專案是否運行中
3. 確認資料表已建立
4. 重啟開發伺服器

### 問題：無法編輯公告

**原因**：RLS 政策未正確設定

**解決**：重新執行 `db/rls_announcements.sql`

### 問題：修改不會即時同步

**原因**：Realtime 未啟用

**解決**：
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
```

---

## 📚 詳細文件

- [完整管理指南](ANNOUNCEMENTS_MANAGEMENT.md)
- [Supabase 公告整合說明](../db/README_ANNOUNCEMENTS_SUPABASE.md)

---

## 🚀 快速指令

```bash
# 執行設定助手（顯示所有 SQL）
bash scripts/setup-announcements.sh

# 啟動開發伺服器
npm run dev

# 讀取公告
node scripts/manage-announcements.js get

# 更新公告
node scripts/manage-announcements.js update "新內容"
```

---

完成設定後，您就可以：
- ✅ 在首頁直接編輯公告
- ✅ 所有使用者即時看到更新
- ✅ 內容永久儲存在 Supabase
- ✅ 支援多人同時編輯
