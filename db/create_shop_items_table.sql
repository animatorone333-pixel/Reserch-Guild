-- 建立商店商品表
CREATE TABLE IF NOT EXISTS public.shop_items (
  id BIGSERIAL PRIMARY KEY,
  position INT NOT NULL UNIQUE,  -- 格子位置 (0-11)
  item_name TEXT DEFAULT '',
  image_url TEXT DEFAULT '',      -- Supabase Storage 的圖片 URL
  user_id TEXT DEFAULT 'guest',   -- 預留給未來多使用者功能
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_shop_items_position ON public.shop_items(position);
CREATE INDEX IF NOT EXISTS idx_shop_items_user_id ON public.shop_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_updated_at ON public.shop_items(updated_at DESC);

-- 建立更新時間的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_shop_items_updated_at ON public.shop_items;
CREATE TRIGGER update_shop_items_updated_at
  BEFORE UPDATE ON public.shop_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 插入預設的 12 個格子
INSERT INTO public.shop_items (position, item_name, image_url, user_id)
SELECT 
  generate_series AS position,
  '' AS item_name,
  '' AS image_url,
  'guest' AS user_id
FROM generate_series(0, 11)
ON CONFLICT (position) DO NOTHING;

-- 啟用 Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_items;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- 新增註解
COMMENT ON TABLE shop_items IS '商店商品資料表';
COMMENT ON COLUMN shop_items.position IS '格子位置 (0-11)';
COMMENT ON COLUMN shop_items.item_name IS '商品名稱';
COMMENT ON COLUMN shop_items.image_url IS '圖片 URL（來自 Supabase Storage）';
COMMENT ON COLUMN shop_items.user_id IS '使用者 ID（預留多使用者功能）';
