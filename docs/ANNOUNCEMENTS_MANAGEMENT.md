# 首頁公告管理指南

本指南說明如何設定、管理與同步首頁的最新公告功能。

## 📋 目錄
- [快速開始](#快速開始)
- [Supabase 設定](#supabase-設定)
- [管理公告](#管理公告)
- [疑難排解](#疑難排解)

---

## 🚀 快速開始

### 當前狀態
✅ 首頁公告功能已實作在 [app/page.tsx](../app/page.tsx)
✅ API route 已建立在 [app/api/announcements/route.ts](../app/api/announcements/route.ts)
✅ 管理工具已建立在 [scripts/manage-announcements.js](../scripts/manage-announcements.js)

### 運作模式
1. **Supabase 模式**（推薦）：公告儲存在 Supabase，支援即時同步
2. **LocalStorage 模式**（降級）：公告儲存在本地瀏覽器

---

## 🗄️ Supabase 設定

### 步驟 1: 建立資料表

在 Supabase SQL Editor 執行：

```sql
-- 建立公告資料表
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  content TEXT DEFAULT '',
  updated_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入預設公告（只會有一筆記錄）
INSERT INTO announcements (id, content, updated_by) VALUES
  (1, '💌最新公告
歡迎來到研究公會！
這裡是最新消息區域，
管理員可以即時編輯公告內容。

所有人都會立即看到更新！', 'system')
ON CONFLICT (id) DO NOTHING;

-- 建立更新時間的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 步驟 2: 設定 RLS（Row Level Security）

```sql
-- 啟用 RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀取
CREATE POLICY "Allow public read access on announcements"
  ON announcements FOR SELECT
  TO public
  USING (true);

-- 允許所有人更新（可根據需求改為只允許管理員）
CREATE POLICY "Allow public update on announcements"
  ON announcements FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
```

⚠️ **安全性提醒**：現行政策允許所有人編輯。如需限制，可修改為：
```sql
-- 只允許已登入使用者更新
USING (auth.role() = 'authenticated')
```

### 步驟 3: 啟用 Realtime

在 Supabase SQL Editor 執行：

```sql
-- 啟用 Realtime 發布
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
```

或在 Supabase Dashboard：
1. 進入 **Database** → **Replication**
2. 勾選 `announcements` 表格
3. 點擊 **Save**

### 步驟 4: 設定環境變數

確保 `.env.local` 包含正確的 Supabase 設定：

```bash
# 在 Supabase Dashboard → Settings → API 找到這些值
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **重要**：`NEXT_PUBLIC_SUPABASE_ANON_KEY` 應該是 `eyJ` 開頭的 JWT token，不是 `ssb_publishable_` 開頭。

---

## 📝 管理公告

### 方法 1: 直接在首頁編輯（推薦）

1. 啟動開發伺服器：`npm run dev`
2. 開啟首頁 http://localhost:3000
3. 在公告板直接編輯內容
4. 內容會自動儲存並即時同步到所有使用者

### 方法 2: 使用管理腳本

啟動開發伺服器後，開啟另一個終端：

```bash
# 讀取當前公告
node scripts/manage-announcements.js get

# 更新公告（換行使用 \n）
node scripts/manage-announcements.js update "💌最新公告
🔸下次桌遊將在1/15舉行!
🔸歡迎報名參加!"
```

### 方法 3: 使用 API

**讀取公告**
```bash
curl http://localhost:3000/api/announcements
```

**更新公告**
```bash
curl -X POST http://localhost:3000/api/announcements \
  -H "Content-Type: application/json" \
  -d '{"content": "新的公告內容", "updatedBy": "admin"}'
```

### 方法 4: 直接在 Supabase Dashboard 編輯

1. 進入 Supabase Dashboard
2. **Table Editor** → `announcements` 表格
3. 編輯 `id=1` 的記錄
4. 修改 `content` 欄位
5. 儲存後會自動同步到所有網頁

---

## 🔍 疑難排解

### 問題 1: 公告無法同步

**症狀**：在一個瀏覽器編輯，另一個瀏覽器沒有更新

**檢查步驟**：
1. 確認 Realtime 已啟用：
   ```sql
   -- 在 Supabase SQL Editor 執行
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```
   應該能看到 `announcements` 表格

2. 檢查瀏覽器 Console 是否有錯誤
3. 確認環境變數正確設定

### 問題 2: 顯示 "Invalid API key"

**原因**：Supabase API key 格式錯誤

**解決方法**：
1. 前往 Supabase Dashboard → Settings → API
2. 複製 **anon/public** key（應該是 `eyJ` 開頭的長字串）
3. 更新 `.env.local`：
   ```bash
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...完整的key
   ```
4. 重啟開發伺服器

### 問題 3: 公告顯示預設內容

**原因**：Supabase 連線失敗，回退到 LocalStorage 模式

**檢查**：
- 查看首頁公告板右上角的狀態指示：
  - 🟢 Supabase：正常運作
  - 🟡 LocalStorage：降級模式

**解決**：
1. 檢查 `.env.local` 設定
2. 檢查 Supabase 專案狀態
3. 確認資料表已建立

### 問題 4: RLS 政策阻擋存取

**症狀**：瀏覽器 Console 顯示 "new row violates row-level security policy"

**解決**：確認 RLS 政策已正確設定（參考步驟 2）

---

## 📊 測試即時同步

1. 開啟兩個瀏覽器視窗（或無痕模式）
2. 都導航到首頁
3. 在第一個視窗編輯公告
4. 第二個視窗應該在 1-2 秒內自動更新（無需重新整理）

---

## 🎯 進階設定

### 限制編輯權限

如果只想讓特定使用者編輯公告，修改 RLS 政策：

```sql
-- 刪除現有的更新政策
DROP POLICY IF EXISTS "Allow public update on announcements" ON announcements;

-- 建立新的限制政策（範例：只允許特定 email）
CREATE POLICY "Allow admin update on announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (auth.email() = 'admin@example.com')
  WITH CHECK (auth.email() = 'admin@example.com');
```

### 新增公告歷史記錄

建立歷史表格記錄每次修改：

```sql
CREATE TABLE announcement_history (
  id BIGSERIAL PRIMARY KEY,
  announcement_id BIGINT,
  content TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立觸發器自動記錄
CREATE OR REPLACE FUNCTION log_announcement_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO announcement_history (announcement_id, content, updated_by)
  VALUES (OLD.id, OLD.content, OLD.updated_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_announcement_updates
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION log_announcement_change();
```

---

## 📚 相關檔案

- 首頁實作：[app/page.tsx](../app/page.tsx#L133-L310)
- API Route：[app/api/announcements/route.ts](../app/api/announcements/route.ts)
- 建表 SQL：[db/create_announcements_table.sql](../db/create_announcements_table.sql)
- RLS SQL：[db/rls_announcements.sql](../db/rls_announcements.sql)
- 管理腳本：[scripts/manage-announcements.js](../scripts/manage-announcements.js)
- 詳細說明：[db/README_ANNOUNCEMENTS_SUPABASE.md](../db/README_ANNOUNCEMENTS_SUPABASE.md)

---

## ✅ 檢查清單

設定完成後，確認以下項目：

- [ ] Supabase 資料表已建立
- [ ] RLS 政策已設定
- [ ] Realtime 已啟用
- [ ] 環境變數正確設定
- [ ] 開發伺服器運行中
- [ ] 首頁可正常編輯公告
- [ ] 多個瀏覽器可即時同步
- [ ] 狀態指示顯示 🟢 Supabase

---

如有問題，請參考 [Supabase 官方文件](https://supabase.com/docs) 或檢查瀏覽器 Console 的錯誤訊息。
