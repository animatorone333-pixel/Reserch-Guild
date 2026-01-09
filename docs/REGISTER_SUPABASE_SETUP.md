# 📋 報名系統 Supabase 完整設定指南

## 🎯 概述

這份指南將協助你在 Supabase 建立完整的報名系統，包含：
- ✅ **registrations** 表：儲存報名資料
- ✅ **event_dates** 表：儲存活動日期和圖片
- ✅ RLS 政策：控制權限
- ✅ Realtime 訂閱：即時同步

---

## 🚀 快速設定（5 分鐘）

### 步驟 1：執行完整 SQL

1. 前往 **Supabase Dashboard**
2. 選擇你的專案
3. 點擊左側選單 **SQL Editor**
4. 點擊 **New query**
5. 複製貼上以下檔案內容：

📄 **檔案位置**：`db/setup_registrations_complete.sql`

或直接複製執行：

```sql
-- =============================================
-- 報名系統完整設定 SQL（包含 registrations 和 event_dates）
-- =============================================

-- 1. 確保 registrations 資料表存在
CREATE TABLE IF NOT EXISTS registrations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  event_date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_registrations_event_date ON registrations(event_date);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at DESC);

-- 3. 建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_registrations_updated_at ON registrations;
CREATE TRIGGER update_registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. 啟用 RLS
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- 5. 刪除舊政策
DROP POLICY IF EXISTS "Allow public read access on registrations" ON registrations;
DROP POLICY IF EXISTS "Allow public insert on registrations" ON registrations;
DROP POLICY IF EXISTS "Allow public update on registrations" ON registrations;
DROP POLICY IF EXISTS "Allow public delete on registrations" ON registrations;

-- 6. 建立 registrations RLS 政策
CREATE POLICY "Allow public read access on registrations"
  ON registrations FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on registrations"
  ON registrations FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update on registrations"
  ON registrations FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete on registrations"
  ON registrations FOR DELETE TO public USING (true);

-- 7. 啟用 registrations Realtime
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
EXCEPTION 
  WHEN duplicate_object THEN NULL;
END $$;

-- 8. 建立 event_dates 表
CREATE TABLE IF NOT EXISTS event_dates (
  id BIGSERIAL PRIMARY KEY,
  event_date TEXT NOT NULL UNIQUE,
  image_url TEXT DEFAULT '/game_16.png',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 建立 event_dates 索引
CREATE INDEX IF NOT EXISTS idx_event_dates_display_order ON event_dates(display_order);

-- 10. 建立 event_dates 觸發器
DROP TRIGGER IF EXISTS update_event_dates_updated_at ON event_dates;
CREATE TRIGGER update_event_dates_updated_at
  BEFORE UPDATE ON event_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 11. 啟用 event_dates RLS
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;

-- 12. 刪除舊的 event_dates 政策
DROP POLICY IF EXISTS "Allow public read access on event_dates" ON event_dates;
DROP POLICY IF EXISTS "Allow public insert on event_dates" ON event_dates;
DROP POLICY IF EXISTS "Allow public update on event_dates" ON event_dates;
DROP POLICY IF EXISTS "Allow public delete on event_dates" ON event_dates;

-- 13. 建立 event_dates RLS 政策
CREATE POLICY "Allow public read access on event_dates"
  ON event_dates FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on event_dates"
  ON event_dates FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update on event_dates"
  ON event_dates FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete on event_dates"
  ON event_dates FOR DELETE TO public USING (true);

-- 14. 插入預設日期（每月前三個星期一，以 2026/01 為例）
INSERT INTO event_dates (event_date, image_url, display_order) VALUES
  ('1/5', '/game_16.png', 1),
  ('1/12', '/game_17.png', 2),
  ('1/19', '/game_18.png', 3)
ON CONFLICT (event_date) DO NOTHING;

-- 15. 啟用 event_dates Realtime
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE event_dates;
EXCEPTION 
  WHEN duplicate_object THEN NULL;
END $$;

-- 16. 驗證設定
SELECT 
  'registrations 和 event_dates 資料表已設定完成' as message,
  (SELECT count(*) FROM registrations) as total_registrations,
  (SELECT count(*) FROM event_dates) as total_event_dates;
```

6. 點擊 **Run** 執行

---

## ✅ 驗證設定

### 檢查 1：資料表是否建立成功

1. 前往 **Table Editor**
2. 應該看到兩張表：
   - ✅ `registrations`
   - ✅ `event_dates`

### 檢查 2：查看資料表結構

**registrations 表結構**：
```
id           | BIGSERIAL (Primary Key)
name         | TEXT (必填)
department   | TEXT (必填)
event_date   | TEXT (必填)
created_at   | TIMESTAMPTZ (自動)
updated_at   | TIMESTAMPTZ (自動)
```

**event_dates 表結構**：
```
id             | BIGSERIAL (Primary Key)
event_date     | TEXT (唯一)
image_url      | TEXT (預設 /game_16.png)
display_order  | INT (排序)
created_at     | TIMESTAMPTZ (自動)
updated_at     | TIMESTAMPTZ (自動)
```

### 檢查 3：確認 RLS 政策

1. 前往 **Authentication → Policies**
2. 選擇 `registrations` 表
3. 應該看到 4 個政策：
   - ✅ Allow public read access
   - ✅ Allow public insert
   - ✅ Allow public update
   - ✅ Allow public delete

4. 選擇 `event_dates` 表
5. 應該看到相同的 4 個政策

### 檢查 4：確認 Realtime 已啟用

1. 前往 **Database → Replication**
2. 找到 `supabase_realtime` publication
3. 確認包含：
   - ✅ `registrations`
   - ✅ `event_dates`

---

## 🧪 測試同步功能

### 測試 1：本地測試（開發環境）

```bash
# 啟動開發伺服器
npm run dev

# 開啟瀏覽器
# http://localhost:3000/register
```

**測試項目**：
1. ✅ 右上角顯示 🟢 Supabase（不是 🟡 Fallback）
2. ✅ 看到三張卡片（1/5, 1/12, 1/19）
3. ✅ 點擊任一卡片報名
4. ✅ 報名後名單立即出現在卡片下方

### 測試 2：多視窗即時同步

1. 開啟**兩個瀏覽器視窗**
2. 都訪問 http://localhost:3000/register
3. 在**視窗 A** 報名
4. **視窗 B** 應該立即看到新的報名資料 ✅

### 測試 3：跨裝置同步

1. 在**電腦**上報名
2. 用**手機**開啟相同網址
3. 手機應該看到電腦的報名資料 ✅

---

## 🔧 進階設定（可選）

### 修改預設日期

```sql
-- 更新日期為每月前三個星期一（以 2026/02 為例）
UPDATE event_dates SET event_date = '2/2' WHERE display_order = 1;
UPDATE event_dates SET event_date = '2/9' WHERE display_order = 2;
UPDATE event_dates SET event_date = '2/16' WHERE display_order = 3;
```

### 新增更多日期

```sql
-- 新增第四個日期（如果需要）
INSERT INTO event_dates (event_date, image_url, display_order) VALUES
  ('1/26', '/game_19.png', 4);
```

### 修改卡片圖片

```sql
UPDATE event_dates 
SET image_url = '/you/5age.png' 
WHERE event_date = '10/13';
```

### 查看所有報名資料

```sql
SELECT 
  r.id,
  r.name,
  r.department,
  r.event_date,
  r.created_at
FROM registrations r
ORDER BY r.created_at DESC;
```

### 依日期統計報名人數

```sql
SELECT 
  event_date,
  COUNT(*) as total_registrations
FROM registrations
GROUP BY event_date
ORDER BY event_date;
```

---

## 🐛 常見問題

### Q1: 顯示 🟡 Fallback 而不是 🟢 Supabase

**原因**：環境變數未設定

**解決方案**：
1. 檢查 `.env.local` 檔案
2. 確認有以下內容：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
3. 重啟開發伺服器：`npm run dev`

### Q2: 報名後沒有立即顯示

**原因**：Realtime 未啟用

**解決方案**：
1. 執行 SQL：
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
   ALTER PUBLICATION supabase_realtime ADD TABLE event_dates;
   ```
2. 重新整理頁面

### Q3: 出現 "row-level security policy" 錯誤

**原因**：RLS 政策未設定

**解決方案**：
重新執行 `setup_registrations_complete.sql`

### Q4: 多視窗不同步

**原因**：
1. Realtime 未啟用
2. 瀏覽器快取

**解決方案**：
1. 按 Ctrl+Shift+R 強制重新整理
2. 檢查 Realtime 設定
3. 查看 Console 是否有錯誤訊息

---

## 📊 資料結構圖

```
┌─────────────────────────────────────┐
│         event_dates 表              │
├─────────────────────────────────────┤
│ 1/5  | /game_16.png | order: 1     │
│ 1/12 | /game_17.png | order: 2     │
│ 1/19 | /game_18.png | order: 3     │
└─────────────────────────────────────┘
              ↓ 關聯 (event_date)
┌─────────────────────────────────────┐
│       registrations 表              │
├─────────────────/5           │
│ 2. 李小華 | 設計部 | 1/12          │
│ 3. 張小強 | 行銷部 | 1/5           │
│ 3. 張小強 | 行銷部 | 10/13         │
└─────────────────────────────────────┘
```

---

## 🚀 部署到 Vercel

確保 Vercel 有設定環境變數：

1. 前往 **Vercel Dashboard**
2. 選擇專案 → **Settings → Environment Variables**
3. 新增：
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
   ```
4. 點擊 **Save**
5. 觸發重新部署：**Deployments → Redeploy**

---

## ✅ 完成清單

- [ ] 在 Supabase 執行 `setup_registrations_complete.sql`
- [ ] 確認兩張表都建立成功
- [ ] 確認 RLS 政策已設定（每張表 4 個政策）
- [ ] 確認 Realtime 已啟用
- [ ] 本地測試：顯示 🟢 Supabase
- [ ] 本地測試：報名功能正常
- [ ] 多視窗測試：即時同步
- [ ] Vercel 環境變數已設定
- [ ] 線上測試：功能正常

---

## 📞 需要幫助？

如果遇到問題：
1. 檢查 F12 Console 的錯誤訊息
2. 確認 Supabase 表和政策都已建立
3. 確認環境變數正確
4. 嘗試強制重新整理（Ctrl+Shift+R）

🎉 **設定完成後，你的報名系統就能即時同步了！**
