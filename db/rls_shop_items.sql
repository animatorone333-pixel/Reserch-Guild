-- 啟用 RLS
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

-- Grants：RLS 只決定列存取，仍需要 table/sequence 權限
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_items TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.shop_items_id_seq TO anon, authenticated;

-- 重跑安全：先移除舊政策
DROP POLICY IF EXISTS "Allow public read access on shop_items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow public insert on shop_items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow public update on shop_items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow public delete on shop_items" ON public.shop_items;

-- 允許所有人讀取
CREATE POLICY "Allow public read access on shop_items"
  ON public.shop_items FOR SELECT
  TO public
  USING (true);

-- 允許所有人新增
CREATE POLICY "Allow public insert on shop_items"
  ON public.shop_items FOR INSERT
  TO public
  WITH CHECK (true);

-- 允許所有人更新
CREATE POLICY "Allow public update on shop_items"
  ON public.shop_items FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 允許所有人刪除
CREATE POLICY "Allow public delete on shop_items"
  ON public.shop_items FOR DELETE
  TO public
  USING (true);

-- 如果未來需要多使用者隔離，可以修改政策為：
-- USING (user_id = current_setting('request.jwt.claims')::json->>'sub')
-- 目前設為 public 方便內部使用
