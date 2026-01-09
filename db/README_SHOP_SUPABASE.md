# Shop 商店頁面 Supabase 設定指南

## 概述

Shop 商店頁面已經升級為使用 Supabase 作為主要資料儲存，並使用 **Supabase Storage** 來處理圖片上傳，支援多人即時同步商品資訊。

## 功能特點

- ✅ **圖片上傳**：使用 Supabase Storage 儲存圖片
- ✅ **即時同步**：商品名稱和圖片即時同步到資料庫
- ✅ **樂觀更新**：上傳時立即顯示預覽
- ✅ **自動備援**：Supabase + Google Sheets + localStorage
- ✅ **即時協作**：多人可同時編輯不同格子
- ✅ **狀態指示器**：右上角顯示資料來源

## 資料結構

### shop_items（商品資料表）

```sql
- id: BIGSERIAL PRIMARY KEY
- position: INT UNIQUE（格子位置 0-11）
- item_name: TEXT（商品名稱）
- image_url: TEXT（圖片 URL，來自 Supabase Storage）
- user_id: TEXT（使用者 ID，預留多使用者功能）
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### Supabase Storage Bucket

- **Bucket 名稱**：`shop-images`
- **類型**：Public（公開可訪問）
- **用途**：儲存商品圖片
- **檔名格式**：`{position}_{timestamp}.{extension}`

## 設定步驟

### 步驟 1：在 Supabase 建立資料表

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇您的專案
3. 進入 SQL Editor
4. 執行以下 SQL：

```bash
# 1. 建立 shop_items 表
cat db/create_shop_items_table.sql

# 2. 設定 RLS 政策
cat db/rls_shop_items.sql
```

### 步驟 2：建立 Storage Bucket

> ⚠️ **重要**：這是最關鍵的步驟，缺少這個 bucket 圖片無法上傳！

1. 前往 **Storage** 頁面
2. 點擊 **"Create a new bucket"**
3. 設定如下：
   - **Name**: `shop-images`（必須完全一致）
   - **Public bucket**: ✅ **勾選**（讓圖片可公開訪問）
   - **File size limit**: 5MB
   - **Allowed MIME types**: `image/*`

4. 點擊 **Create bucket**

### 步驟 3：設定 Storage 政策

1. 進入 **Storage** → **Policies** → **shop-images**
2. 點擊 **"New Policy"**
3. 依序新增以下政策（或在 SQL Editor 執行）：

```sql
-- 允許公開上傳
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'shop-images');

-- 允許公開讀取
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shop-images');

-- 允許公開更新
CREATE POLICY "Allow public updates"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'shop-images');

-- 允許公開刪除
CREATE POLICY "Allow public deletes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'shop-images');
```

### 步驟 4：啟用 Realtime

在 Supabase Dashboard：
1. 前往 **Database** → **Replication**
2. 確認 `shop_items` 表已加入 `supabase_realtime` publication
3. 如果沒有，點擊開關啟用

### 步驟 5：設定環境變數

確保 `.env.local` 檔案包含（與其他功能共用）：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 步驟 6：測試

1. 啟動開發伺服器：
```bash
npm run dev
```

2. 前往 `/shop` 頁面

3. 檢查右上角狀態指示器：
   - 🟢 **Supabase**：成功連接
   - 🟡 **Fallback**：使用本地模式

4. 測試功能：
   - 上傳圖片到任意格子
   - 輸入商品名稱
   - 開啟多個瀏覽器視窗測試即時同步

## 資料流程

### 使用 Supabase 時：

```
1. 選擇圖片 → 本地預覽（立即顯示）
          ↓
2. 上傳到 Storage → 取得公開 URL
          ↓
3. 寫入資料庫 → 儲存 URL 和名稱
          ↓
4. Realtime 推送 → 其他用戶即時更新
```

### Fallback 模式：

```
編輯商品 → localStorage 儲存
         ↓
   點擊送出 → Google Sheets API
```

## 使用情境

### 情境 1：上傳商品圖片
1. 點擊任意格子的「上傳圖片」
2. 選擇圖片檔案
3. 圖片立即顯示預覽
4. 背景自動上傳到 Supabase Storage
5. 其他用戶即時看到新圖片

### 情境 2：編輯商品名稱
1. 在格子下方輸入商品名稱
2. 輸入時即時儲存到資料庫
3. 其他用戶即時看到名稱更新

### 情境 3：多人協作
- 使用者 A 編輯格子 0-5
- 使用者 B 編輯格子 6-11
- 雙方互不干擾，即時同步

## 維護與監控

### 查看 Supabase 資料

```sql
-- 查看所有商品
SELECT * FROM shop_items ORDER BY position;

-- 查看有圖片的商品
SELECT * FROM shop_items WHERE image_url != '' ORDER BY position;

-- 查看有名稱的商品
SELECT * FROM shop_items WHERE item_name != '' ORDER BY position;

-- 清空所有商品
UPDATE shop_items SET item_name = '', image_url = '';
```

### 查看 Storage 檔案

1. 前往 **Storage** → **shop-images**
2. 可看到所有上傳的圖片檔案
3. 檔名格式：`0_1704700800000.jpg`（位置_時間戳.副檔名）

### 管理 Storage 空間

```sql
-- 查看 Storage 使用量（在 Storage 頁面查看）
-- 或使用 Supabase Dashboard 的 Usage 頁面
```

### 偵錯

開啟瀏覽器開發者工具（F12），在 Console 中：

- `✅ 從 Supabase 載入商品成功` - 成功載入
- `❌ 從 Supabase 載入失敗: ...` - 載入失敗
- `❌ 上傳圖片失敗: ...` - 圖片上傳失敗（檢查 bucket 是否存在）
- `❌ 更新資料庫失敗: ...` - 資料庫寫入失敗
- `📡 Shop items 變更: ...` - Realtime 收到變更

## 常見問題

### Q: 為什麼上傳圖片後顯示錯誤？

A: 可能原因：
1. ❌ Storage bucket `shop-images` 不存在
2. ❌ Bucket 未設為 Public
3. ❌ Storage 政策未正確設定
4. ❌ 圖片太大（超過 5MB）

**解決方法**：
1. 檢查 Storage 頁面是否有 `shop-images` bucket
2. 確認 bucket 設定為 Public
3. 重新執行 Storage 政策 SQL
4. 壓縮圖片後重試

### Q: 如何驗證 Storage 是否正確設定？

A: 在瀏覽器 Console 執行：

```javascript
// 測試 bucket 是否可訪問
const { data, error } = await supabase.storage
  .from('shop-images')
  .list();

if (error) {
  console.error('Bucket 不可訪問:', error);
} else {
  console.log('✅ Bucket 可用，檔案列表:', data);
}
```

### Q: 圖片上傳成功但顯示不出來？

A: 可能原因：
1. Bucket 未設為 Public
2. CORS 設定問題
3. 瀏覽器快取

**解決方法**：
1. 確認 bucket 設定為 Public
2. 重新整理頁面（Ctrl + F5）
3. 檢查圖片 URL 是否可直接訪問

### Q: 如何遷移現有的 localStorage 資料？

A: 目前需要手動重新上傳。未來可考慮實作匯入功能。

### Q: 可以限制圖片大小或格式嗎？

A: 可以！在建立 bucket 時設定，或在程式碼中驗證：

```typescript
const handleImageChange = async (index: number, file: File) => {
  // 檢查檔案大小（5MB = 5 * 1024 * 1024）
  if (file.size > 5 * 1024 * 1024) {
    alert('圖片太大，請選擇小於 5MB 的圖片');
    return;
  }

  // 檢查檔案類型
  if (!file.type.startsWith('image/')) {
    alert('請選擇圖片檔案');
    return;
  }

  // 繼續處理...
};
```

### Q: 舊圖片會自動刪除嗎？

A: 會！當上傳新圖片時，程式會自動刪除同一格子的舊圖片，避免浪費空間。

### Q: 如何批次清理未使用的圖片？

A: 使用以下步驟：

1. 列出所有圖片：
```javascript
const { data: files } = await supabase.storage
  .from('shop-images')
  .list();
```

2. 比對資料庫中的 `image_url`，刪除不在資料庫中的檔案

## 效能優化

### 1. 圖片壓縮

建議在前端壓縮圖片再上傳：

```bash
npm install browser-image-compression
```

```typescript
import imageCompression from 'browser-image-compression';

const handleImageChange = async (index: number, file: File) => {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 800,
    useWebWorker: true
  };
  
  const compressedFile = await imageCompression(file, options);
  // 繼續上傳 compressedFile
};
```

### 2. 圖片 CDN

Supabase Storage 已經提供 CDN 加速，圖片載入速度很快。

### 3. 快取策略

Storage 預設使用 `cacheControl: '3600'`（1 小時），可根據需求調整。

## 安全性

### 目前設定（內部使用）
- ✅ Public bucket 允許任何人上傳和讀取
- ✅ 適合小團隊內部使用
- ⚠️ 需要防止濫用

### 加強安全性建議

1. **限制檔案類型和大小**：
   - 在 bucket 設定中限制
   - 前端驗證

2. **使用 RLS 限制存取**：
```sql
-- 只允許已登入使用者上傳
CREATE POLICY "Authenticated uploads only"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shop-images');
```

3. **使用 Edge Functions 處理圖片**：
   - 自動壓縮
   - 加浮水印
   - 掃描惡意檔案

## 效能指標

- **圖片上傳速度**：~1-3 秒（視圖片大小）
- **即時同步延遲**：~50-200ms
- **首次載入**：~300-800ms

## 相關檔案

- [app/shop/page.tsx](../app/shop/page.tsx) - 主要元件
- [db/create_shop_items_table.sql](create_shop_items_table.sql) - 資料表
- [db/rls_shop_items.sql](rls_shop_items.sql) - RLS 政策
- [db/storage_setup_shop.md](storage_setup_shop.md) - Storage 設定指南

## 未來改進方向

1. **圖片編輯**：裁切、旋轉、濾鏡
2. **批次上傳**：一次上傳多張圖片
3. **拖曳排序**：拖曳調整商品順序
4. **圖片畫廊**：查看所有已上傳的圖片
5. **版本控制**：保留圖片歷史記錄
6. **自動壓縮**：上傳前自動優化圖片

## 需要幫助？

如有問題，請檢查：
1. Storage 頁面確認 `shop-images` bucket 存在
2. Bucket 設定為 Public
3. Storage 政策已正確設定
4. 瀏覽器 Console 的錯誤訊息
5. Supabase Dashboard 的 Logs

---

**重要提醒**：
- 必須先建立 `shop-images` bucket 才能上傳圖片
- Bucket 必須設為 Public 才能顯示圖片
- Storage 政策必須正確設定才能上傳/刪除
