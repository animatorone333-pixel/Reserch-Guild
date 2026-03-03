-- 將 vote_room_votes 升級為支援：
-- 1) 投票日期可複選（vote_days JSON 陣列）
-- 2) 遊戲網址（game_url）
-- 3) 遊戲價格（game_price）

ALTER TABLE public.vote_room_votes
  ADD COLUMN IF NOT EXISTS game_url TEXT;

ALTER TABLE public.vote_room_votes
  ADD COLUMN IF NOT EXISTS game_price NUMERIC(10,2);

ALTER TABLE public.vote_room_votes
  ADD COLUMN IF NOT EXISTS vote_days JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 將既有單一日期回填到 vote_days（若目前是空陣列）
UPDATE public.vote_room_votes
SET vote_days = jsonb_build_array(to_char(vote_day, 'YYYY-MM-DD'))
WHERE jsonb_typeof(vote_days) = 'array'
  AND jsonb_array_length(vote_days) = 0
  AND vote_day IS NOT NULL;

ALTER TABLE public.vote_room_votes
  DROP CONSTRAINT IF EXISTS vote_room_votes_game_price_non_negative;
ALTER TABLE public.vote_room_votes
  ADD CONSTRAINT vote_room_votes_game_price_non_negative
  CHECK (game_price IS NULL OR game_price >= 0);
