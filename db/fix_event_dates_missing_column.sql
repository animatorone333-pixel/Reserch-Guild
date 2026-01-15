-- =============================================
-- 修復: 補上 event_dates 缺少的 display_order 欄位
-- 用途: 解決網頁無法編輯日期、或找不到 display_order 欄位的問題
-- =============================================

-- 1. 新增 display_order 欄位 (若不存在)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'event_dates'
        AND column_name = 'display_order'
    ) THEN
        ALTER TABLE event_dates ADD COLUMN display_order INT DEFAULT 0;
    END IF;
END $$;

-- 2. 為現有資料設定正確的順序
--    這會依照 ID 順序將 display_order 設為 1, 2, 3...
WITH sorted_dates AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) as new_order
  FROM event_dates
)
UPDATE event_dates
SET display_order = sorted_dates.new_order
FROM sorted_dates
WHERE event_dates.id = sorted_dates.id;

-- 3. 確保 RLS 權限允許更新 (UPDATE)
--    確保 anon (未登入使用者) 對該欄位有讀寫權限
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_dates TO anon, authenticated;

-- 重新套用較寬鬆的 UPDATE 策略，確保網頁端可以寫入
DROP POLICY IF EXISTS "Allow public update on event_dates" ON event_dates;
CREATE POLICY "Allow public update on event_dates"
  ON event_dates FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
  
-- SELECT 策略
DROP POLICY IF EXISTS "Allow public select on event_dates" ON event_dates;
CREATE POLICY "Allow public select on event_dates"
  ON event_dates FOR SELECT
  TO public
  USING (true);

-- 4. 建立/修復 display_order 索引 (加速查詢和排序)
CREATE INDEX IF NOT EXISTS idx_event_dates_display_order ON event_dates(display_order);

-- 5. 確保 Realtime 功能 (即時更新)
ALTER PUBLICATION supabase_realtime ADD TABLE event_dates;
