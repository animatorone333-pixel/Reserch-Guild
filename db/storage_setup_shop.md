-- Supabase Storage Bucket 設定指南

-- 注意：這些操作需要在 Supabase Dashboard 的 Storage 頁面進行
-- 無法直接用 SQL 建立，請按照以下步驟操作

## 步驟 1：建立 Bucket

1. 前往 Supabase Dashboard → Storage
2. 點擊 "Create a new bucket"
3. 設定：
   - Name: `shop-images`
   - Public bucket: ✅ 勾選（讓圖片可以公開訪問）
   - File size limit: 5MB（或根據需求調整）
   - Allowed MIME types: `image/*`

## 步驟 2：設定 Storage 政策

進入 Storage → Policies → shop-images，新增以下政策：

### 政策 1：允許公開上傳
```sql
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'shop-images');
```

### 政策 2：允許公開讀取
```sql
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shop-images');
```

### 政策 3：允許公開更新
```sql
CREATE POLICY "Allow public updates"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'shop-images')
WITH CHECK (bucket_id = 'shop-images');
```

### 政策 4：允許公開刪除
```sql
CREATE POLICY "Allow public deletes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'shop-images');
```

## 步驟 3：驗證設定

在瀏覽器 Console 測試：

```javascript
const { data, error } = await supabase.storage
  .from('shop-images')
  .list();

console.log('Bucket 可訪問:', !error);
```

## 注意事項

- Bucket name 必須是 `shop-images`（與程式碼對應）
- 必須設為 Public bucket 才能直接顯示圖片
- 檔案會以 `{position}_{timestamp}` 格式命名
- 舊圖片會在上傳新圖時自動刪除

## 目錄結構

```
shop-images/
  ├── 0_1704700800000.jpg    # 位置 0 的圖片
  ├── 1_1704700810000.png    # 位置 1 的圖片
  ├── ...
  └── 11_1704700820000.jpg   # 位置 11 的圖片
```

## 檔案命名規則

- 格式：`{position}_{timestamp}.{extension}`
- 範例：`5_1704700800000.jpg` 表示位置 5 在某時間點上傳的圖片
- 這樣可以避免檔名衝突，且方便追蹤版本
