-- 這是一個修復腳本：解決 "no unique or exclusion constraint" 錯誤並修復權限
-- 請複製此內容到 Supabase SQL Editor 執行

-- 1. 確保 Sequence 權限 (解決 id 自增長權限問題)
GRANT USAGE, SELECT ON SEQUENCE public.shop_items_id_seq TO anon, authenticated;

-- 2. 確保 Table 權限
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_items TO anon, authenticated;

-- 3. 修復 Unique Constraint 缺失的問題 (這是導致 42P10 錯誤的主因)
-- 3.1 先移除重複的 position 資料 (如果有的話，只保留最新的)
DELETE FROM public.shop_items
WHERE id NOT IN (
  SELECT MAX(id)
  FROM public.shop_items
  GROUP BY position
);

-- 3.2 嘗試加入 unique constraint
DO $$
BEGIN
    -- 檢查是否已有 Unique Constraint 或 Index，若無則建立
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_index i ON i.indexrelid = c.oid
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relname = 'shop_items_position_key'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'shop_items_position_key'
    ) THEN
        ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_position_key UNIQUE (position);
    END IF;
EXCEPTION
    WHEN OTHERS THEN 
        RAISE NOTICE 'Constraint creation skipped or failed: %', SQLERRM;
END $$;

-- 4. 確保所有 12 個格子都有初始資料
-- 現在 unique constraint 存在了，ON CONFLICT 應該能正常運作
INSERT INTO public.shop_items (position, item_name, image_url, user_id)
SELECT 
  s.i AS position,
  '' AS item_name,
  '' AS image_url,
  'guest' AS user_id
FROM generate_series(0, 11) AS s(i)
ON CONFLICT (position) DO NOTHING;

-- 5. 再次確認 RLS 政策 (允許所有人操作)
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on shop_items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow public insert on shop_items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow public update on shop_items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow public delete on shop_items" ON public.shop_items;

CREATE POLICY "Allow public read access on shop_items" ON public.shop_items FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert on shop_items" ON public.shop_items FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update on shop_items" ON public.shop_items FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on shop_items" ON public.shop_items FOR DELETE TO public USING (true);
