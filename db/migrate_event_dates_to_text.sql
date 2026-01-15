-- =============================================
-- 修復: 修改 event_dates 型別並補上唯一約束
-- =============================================

-- 1. 將 event_date 欄位型別從 DATE 修改為 TEXT
ALTER TABLE event_dates ALTER COLUMN event_date TYPE TEXT;

-- 2. 清除重複的 event_date (保留 id 較大的) 以便建立唯一約束
--    這一步是為了防止下一步建立 Unique Constraint 失敗
DELETE FROM event_dates a USING event_dates b
WHERE a.id < b.id AND a.event_date = b.event_date;

-- 3. 建立唯一約束 (ON CONFLICT 依賴此約束)
--    先嘗試刪除舊約束避免報錯
ALTER TABLE event_dates DROP CONSTRAINT IF EXISTS event_dates_event_date_key;
ALTER TABLE event_dates ADD CONSTRAINT event_dates_event_date_key UNIQUE (event_date);

-- 4. 插入或更新預設資料
--    現在有了唯一約束，ON CONFLICT 就可以正常運作了
INSERT INTO event_dates (event_date, image_url, display_order) VALUES
  ('1/5', '/game_16.png', 1),
  ('1/12', '/game_17.png', 2),
  ('1/19', '/game_18.png', 3)
ON CONFLICT (event_date) 
DO UPDATE SET 
  image_url = EXCLUDED.image_url,
  display_order = EXCLUDED.display_order;

-- 5. 確保 RLS 權限
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_dates TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.event_dates_id_seq TO anon, authenticated;

-- 6. 設定 RLS 政策
DROP POLICY IF EXISTS "Allow public all event_dates" ON event_dates;
CREATE POLICY "Allow public all event_dates" ON event_dates FOR ALL USING (true) WITH CHECK (true);
