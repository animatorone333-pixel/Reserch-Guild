-- 建立投票頁「遊戲名稱設定」表（只有一筆記錄 id=1）
-- 用途：讓 /vote 的 4 個遊戲名稱可被即時編輯，並透過 Supabase Realtime 同步到所有人。

CREATE TABLE IF NOT EXISTS public.vote_config (
  id BIGINT PRIMARY KEY,
  games JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入預設資料（只會有一筆記錄）
INSERT INTO public.vote_config (id, games, updated_by) VALUES
  (1, '["璀璨寶石", "印加寶藏", "德國蟑螂", "寶可夢卡牌"]'::jsonb, 'system')
ON CONFLICT (id) DO NOTHING;

-- 建立更新時間的觸發器（若已存在同名 function，CREATE OR REPLACE 會覆蓋為相同內容）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vote_config_updated_at ON public.vote_config;
CREATE TRIGGER update_vote_config_updated_at
  BEFORE UPDATE ON public.vote_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_config;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

COMMENT ON TABLE public.vote_config IS '投票頁遊戲名稱設定（單筆 id=1，games 為 4 個遊戲名稱陣列）';
COMMENT ON COLUMN public.vote_config.games IS 'JSON 陣列：4 個遊戲名稱（index 0..3）';
COMMENT ON COLUMN public.vote_config.updated_by IS '更新者（可選）';
