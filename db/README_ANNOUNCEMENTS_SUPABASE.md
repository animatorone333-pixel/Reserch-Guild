# 首頁公告 Supabase 整合說明

本文件說明首頁「最新公告」功能如何與 Supabase 整合，實現即時同步編輯。

## 功能概述

- **即時編輯**：管理員可直接在首頁公告區編輯內容
- **即時同步**：所有在線使用者自動看到最新公告（透過 Realtime）
- **自動備份**：公告內容儲存在 Supabase，不再依賴 localStorage
- **降級機制**：若無 Supabase，自動回退到 localStorage 模式

## 資料庫設定

### 1. 建立 announcements 資料表

執行以下 SQL（參考 `create_announcements_table.sql`）：

```sql
-- 建立公告資料表（單一記錄設計）
CREATE TABLE IF NOT EXISTS public.announcements (
  id INTEGER PRIMARY KEY DEFAULT 1,
  content TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system',
  CONSTRAINT single_record_only CHECK (id = 1)
);

-- 插入預設記錄
INSERT INTO public.announcements (id, content, updated_by)
VALUES (
  1,
  E'💌最新公告\n🔸下次桌遊將在10/13舉行!\n🔸歡迎推薦遊戲品項，請至桌遊投票區開盲盒!\n🔸本月主題日_夜市人生，將舉行射擊遊戲!歡迎來練習!',
  'system'
)
ON CONFLICT (id) DO NOTHING;

-- 建立 updated_at 自動更新觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 Realtime（重要！）
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
```

### 2. 設定 RLS 政策

執行以下 SQL（參考 `rls_announcements.sql`）：

```sql
-- 啟用 RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀取公告
CREATE POLICY "Allow public read access"
  ON public.announcements
  FOR SELECT
  USING (true);

-- 允許所有人更新公告（實際應用中建議加上身份驗證）
CREATE POLICY "Allow public update access"
  ON public.announcements
  FOR UPDATE
  USING (true);
```

⚠️ **注意**：現行政策允許所有人編輯公告。若需限制編輯權限，可修改政策加入身份驗證條件。

### 3. 啟用 Realtime

在 Supabase Dashboard：
1. 進入 **Database** → **Replication**
2. 確認 `announcements` 表格已勾選
3. 點擊 **Save** 儲存變更

## 環境變數設定

在 `.env.local` 設定：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 功能說明

### 前端邏輯 (`app/page.tsx`)

1. **Supabase 初始化**
   - 檢查環境變數是否存在
   - 建立 Supabase client 或設為 null

2. **載入公告**
   - 優先嘗試從 Supabase 載入 (id=1 的記錄)
   - 失敗則回退到 localStorage
   - 無資料則顯示預設公告

3. **編輯公告**
   - 使用者輸入時立即更新 UI（樂觀更新）
   - 同時 UPDATE Supabase (id=1)
   - 無 Supabase 時存入 localStorage

4. **Realtime 訂閱**
   - 訂閱 `public:announcements` 頻道
   - 接收 UPDATE 事件並更新 UI
   - 實現多人即時同步

### 狀態指示器

公告板右上角顯示：
- 🟢 **Supabase**：使用 Supabase 模式
- 🟡 **LocalStorage**：降級到本地模式

## 測試步驟

### 基本功能測試

1. **本地模式測試**（無 Supabase）
   ```bash
   # 暫時移除環境變數
   npm run dev
   ```
   - 編輯公告，重新整理頁面應保持內容
   - 狀態應顯示 🟡 LocalStorage

2. **Supabase 模式測試**
   ```bash
   # 設定好環境變數
   npm run dev
   ```
   - 編輯公告，檢查 Supabase Dashboard 是否更新
   - 狀態應顯示 🟢 Supabase

### 即時同步測試

1. 開啟兩個瀏覽器視窗
2. 在第一個視窗編輯公告
3. 第二個視窗應立即看到變更（無需重新整理）

### SQL 直接測試

在 Supabase SQL Editor 執行：

```sql
-- 查看目前公告
SELECT * FROM public.announcements WHERE id = 1;

-- 更新公告（所有前端應立即同步）
UPDATE public.announcements
SET content = E'🎉 測試公告\n這是透過 SQL 更新的內容'
WHERE id = 1;
```

## 常見問題

### Q1: 狀態顯示 LocalStorage 但有設定環境變數

**解決方式**：
1. 確認 `.env.local` 檔案位於專案根目錄
2. 重新啟動 dev server (`npm run dev`)
3. 檢查環境變數格式是否正確（無多餘空格）

### Q2: 編輯後沒有同步到其他視窗

**可能原因**：
1. Realtime 未啟用 → 檢查 Database → Replication 設定
2. RLS 政策阻擋 → 確認 UPDATE 政策已建立
3. 網路連線問題 → 檢查瀏覽器 Console 是否有錯誤

### Q3: 公告內容遺失

**檢查步驟**：
1. 確認 `announcements` 表格有 id=1 的記錄
2. 執行 `SELECT * FROM announcements WHERE id = 1;`
3. 若無記錄，重新執行 `create_announcements_table.sql`

### Q4: 更新頻率過高導致效能問題

**優化建議**：
- 目前採用即時更新（每次輸入觸發）
- 若需優化，可加入 debounce 機制：
  ```typescript
  // 使用 lodash debounce
  const debouncedUpdate = debounce(async (value) => {
    await supabase.from('announcements').update({ content: value }).eq('id', 1);
  }, 500);
  ```

## 資料庫結構

### announcements 表格

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | INTEGER | 主鍵，固定為 1 |
| `content` | TEXT | 公告內容 |
| `updated_at` | TIMESTAMP | 最後更新時間（自動） |
| `updated_by` | TEXT | 更新者（預留欄位） |

### 設計理念

- **單一記錄**：使用 `CHECK (id = 1)` 確保只有一筆資料
- **簡化查詢**：前端直接查詢 `id=1`，無需複雜邏輯
- **歷史追蹤**：`updated_at` 和 `updated_by` 可用於審計

## 擴充建議

### 1. 多語言支援

新增欄位：
```sql
ALTER TABLE public.announcements
ADD COLUMN content_en TEXT,
ADD COLUMN content_zh TEXT;
```

### 2. 版本歷史

建立歷史表格：
```sql
CREATE TABLE public.announcements_history (
  id SERIAL PRIMARY KEY,
  content TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by TEXT
);

-- 建立觸發器自動記錄變更
CREATE OR REPLACE FUNCTION log_announcement_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.announcements_history (content, updated_by)
  VALUES (OLD.content, OLD.updated_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_announcements
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION log_announcement_change();
```

### 3. 權限管理

整合身份驗證：
```sql
-- 只允許已驗證用戶更新
DROP POLICY IF EXISTS "Allow public update access" ON public.announcements;

CREATE POLICY "Allow authenticated users to update"
  ON public.announcements
  FOR UPDATE
  USING (auth.role() = 'authenticated');
```

## 相關檔案

- 資料表 SQL：`db/create_announcements_table.sql`
- RLS 政策：`db/rls_announcements.sql`
- 前端整合：`app/page.tsx`
- 整體設定：`db/README_SUPABASE_SETUP.md`
