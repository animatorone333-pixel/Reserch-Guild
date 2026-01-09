# 🔧 公告功能錯誤修復指南

## 當前問題

您遇到的錯誤：
```
❌ 從 Supabase 載入公告失敗: {}
```

這個空物件錯誤通常表示 **RLS (Row Level Security) 政策阻擋了查詢**。

## 🚀 快速修復（3 步驟）

### 步驟 1: 在 Supabase 執行完整設定 SQL

1. 開啟 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 點擊左側 **SQL Editor**
4. 複製以下完整檔案的內容並執行：
   ```
   db/setup_announcements_complete.sql
   ```
   或直接複製貼上：

```sql
-- 建立資料表
CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT PRIMARY KEY,
  content TEXT DEFAULT '',
  updated_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入預設資料
INSERT INTO announcements (id, content, updated_by) VALUES
  (1, '💌最新公告
🔸歡迎使用！', 'system')
ON CONFLICT (id) DO NOTHING;

-- 啟用 RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀取
DROP POLICY IF EXISTS "Allow public read access on announcements" ON announcements;
CREATE POLICY "Allow public read access on announcements"
  ON announcements FOR SELECT TO public USING (true);

-- 允許所有人更新
DROP POLICY IF EXISTS "Allow public update on announcements" ON announcements;
CREATE POLICY "Allow public update on announcements"
  ON announcements FOR UPDATE TO public USING (true) WITH CHECK (true);

-- 允許所有人插入
DROP POLICY IF EXISTS "Allow public insert on announcements" ON announcements;
CREATE POLICY "Allow public insert on announcements"
  ON announcements FOR INSERT TO public WITH CHECK (true);

-- 啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
```

### 步驟 2: 驗證設定

在 Supabase SQL Editor 執行：

```sql
-- 檢查資料
SELECT * FROM announcements WHERE id = 1;

-- 檢查 RLS
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'announcements';

-- 檢查政策
SELECT * FROM pg_policies WHERE tablename = 'announcements';
```

應該看到：
- ✅ 有一筆 id=1 的記錄
- ✅ RLS 已啟用 (rowsecurity = true)
- ✅ 有 3 個政策（read, update, insert）

### 步驟 3: 重新載入網頁

1. 開啟 http://localhost:3000
2. 按 F12 開啟開發者工具
3. 切換到 Console 分頁
4. 重新整理頁面（F5）

## ✅ 成功標誌

如果設定成功，您會在 Console 看到：
```
✅ 從 Supabase 載入公告成功
```

首頁公告板右上角應顯示：
```
🟢 Supabase
```

## ❌ 如果仍然失敗

### 檢查 1: API Key 格式

開啟 `.env.local`，確認 API key 是 `eyJ` 開頭：

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...（約 200+ 字元）
```

**不是** `ssb_publishable_` 開頭！

如果不對，請到 Supabase Dashboard → Settings → API 重新複製。

### 檢查 2: 使用診斷工具

```bash
node scripts/diagnose-announcements.js
```

這會顯示詳細的問題診斷。

### 檢查 3: 查看詳細錯誤

更新後的程式碼會在 Console 顯示更詳細的錯誤資訊：

```javascript
{
  message: "錯誤訊息",
  details: "詳細資訊",
  hint: "提示",
  code: "錯誤代碼"
}
```

### 常見錯誤代碼

- **PGRST116**: 找不到資料 → 執行插入 SQL
- **42501**: 權限不足 → 檢查 RLS 政策
- **42P01**: 資料表不存在 → 重新建立資料表
- **Invalid API key**: API key 格式錯誤 → 重新複製正確的 key

## 🧪 測試方法

### 方法 1: 使用測試頁面
```
http://localhost:3000/test-announcements
```

會顯示當前狀態和任何錯誤。

### 方法 2: 直接在 Supabase 測試

在 Supabase → Table Editor：
1. 找到 `announcements` 表格
2. 查看是否有 id=1 的記錄
3. 嘗試編輯內容

### 方法 3: 使用 API

```bash
curl http://localhost:3000/api/announcements
```

應該回傳公告內容（不是錯誤）。

## 📊 預期結果

完成設定後：

✅ Console 顯示：`✅ 從 Supabase 載入公告成功`
✅ 首頁顯示：`🟢 Supabase`
✅ 可以在首頁編輯公告
✅ 編輯時 Console 顯示：`✅ 公告已同步到 Supabase`
✅ 多個瀏覽器可即時同步

## 💡 為什麼會出現空物件錯誤？

Supabase 在遇到 RLS 阻擋時，會回傳一個空的 error 物件而不是詳細錯誤。這是 PostgREST 的行為。

更新後的程式碼會：
1. 顯示更詳細的錯誤資訊
2. 自動嘗試插入預設公告（如果是找不到資料）
3. 提供錯誤修復提示

## 🆘 需要更多協助？

1. 查看 Console 的詳細錯誤訊息
2. 執行診斷工具：`node scripts/diagnose-announcements.js`
3. 訪問測試頁面：http://localhost:3000/test-announcements
4. 檢查 Supabase Dashboard → Table Editor → announcements

---

**記得**：修改環境變數後必須重啟開發伺服器！
```bash
# Ctrl+C 停止
npm run dev
```
