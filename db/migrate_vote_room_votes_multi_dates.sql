-- 將 vote_room_votes 升級為支援：
-- 1) 投票日期可複選（vote_days JSON 陣列）
-- 2) 遊戲網址（game_url）
-- 3) 遊戲價格（game_price）

ALTER TABLE public.vote_room_votes
  ADD COLUMN IF NOT EXISTS game_url TEXT;

ALTER TABLE public.vote_room_votes
  ADD COLUMN IF NOT EXISTS game_price TEXT;

-- 先移除舊的 numeric 檢查，避免轉型成 TEXT 時發生 text >= numeric 錯誤
ALTER TABLE public.vote_room_votes
  DROP CONSTRAINT IF EXISTS vote_room_votes_game_price_non_negative;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vote_room_votes'
      AND column_name = 'game_price'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.vote_room_votes
      ALTER COLUMN game_price TYPE TEXT USING game_price::TEXT;
  END IF;
END $$;

ALTER TABLE public.vote_room_votes
  ADD COLUMN IF NOT EXISTS vote_days JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 將既有單一日期回填到 vote_days（若目前是空陣列）
UPDATE public.vote_room_votes
SET vote_days = jsonb_build_array(to_char(vote_day, 'YYYY-MM-DD'))
WHERE jsonb_typeof(vote_days) = 'array'
  AND jsonb_array_length(vote_days) = 0
  AND vote_day IS NOT NULL;
