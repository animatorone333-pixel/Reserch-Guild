// /vote/page.tsx (最終完整版：包含持久化、重新投票按鈕及樣式)

"use client";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase 設定（與首頁公告一致：client 端直連 + Realtime）
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
const supabase: SupabaseClient | null = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// 🔑 儲存 Key
const VOTES_STORAGE_KEY = "mygame_votes_v1";
const VOTE_GAMES_STORAGE_KEY = "vote_game_names_v1";
const DEFAULT_VOTES = [0, 0, 0, 0]; 

const DEFAULT_GAMES = [
  "璀璨寶石",
  "印加寶藏",
  "德國蟑螂",
  "寶可夢卡牌",
];

const isValidGames = (v: unknown): v is string[] => {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((x) => typeof x === "string")
  );
};

const loadGamesLocal = (): string[] => {
  if (typeof window === "undefined") return DEFAULT_GAMES;
  try {
    const raw = localStorage.getItem(VOTE_GAMES_STORAGE_KEY);
    if (!raw) return DEFAULT_GAMES;
    const parsed = JSON.parse(raw);
    if (isValidGames(parsed)) return parsed;
  } catch (e) {
    console.warn("Failed to load stored vote game names", e);
  }
  return DEFAULT_GAMES;
};

const saveGamesLocal = (games: string[]) => {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(VOTE_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
  } catch (e) {
    console.warn("Failed to save vote game names to localStorage", e);
  }
};

const formatErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as any).message || err);
  return String(err || "");
};

// 🔑 載入投票結果
function loadVotes(): number[] {
  if (typeof window === 'undefined') return DEFAULT_VOTES;
  const raw = localStorage.getItem(VOTES_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // 確保載入的資料是陣列，且長度為 4
      if (Array.isArray(parsed) && parsed.length === 4 && parsed.every(n => typeof n === 'number')) {
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse stored votes:", e);
    }
  }
  return DEFAULT_VOTES;
}

// 隨機排列陣列（保留原本使用）
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BASE_WIDTH = 1200;
const BASE_HEIGHT = 800;

// 工具：矩形交疊判定
function intersectsRect(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  rect: { left: number; top: number; right: number; bottom: number }
) {
  return !(ax + aw <= rect.left || ax >= rect.right || ay + ah <= rect.top || ay >= rect.bottom);
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// 將可能的相對路徑，正規化成可用的絕對路徑（或保留 http/https/data URL）
function normalizeAvatarUrl(u: string): string {
  if (!u) return "/game_04.png";
  const url = u.trim();
  if (/^data:image\//.test(url)) return url;            // base64 data URL
  if (/^https?:\/\//i.test(url)) return url;            // 完整網址
  if (url.startsWith("/")) return url;                  // 絕對路徑
  return "/" + url.replace(/^\.?\//, "");               // 相對→絕對
}

export default function VotePage() {
  const router = useRouter();

  const [useSupabase, setUseSupabase] = useState(false);
  const [isEditingNames, setIsEditingNames] = useState(false);
  const [editingGameIndex, setEditingGameIndex] = useState<number | null>(null);
  const [draftItems, setDraftItems] = useState<string[]>(() => loadGamesLocal());

  // ===== 投票相關（原本保留） =====
  const [items, setItems] = useState<string[]>(() => loadGamesLocal());
  const [shuffledItems, setShuffledItems] = useState<number[]>([]); // 票數區順序：存索引
  const [chestGames, setChestGames] = useState<number[]>([]); // 寶箱順序：存索引
  const [selected, setSelected] = useState<number | null>(null);
  
  // 🔑 修正：從 localStorage 載入初始投票數
  const [votes, setVotes] = useState<number[]>(loadVotes());

  // 🔑 修正：使用 useLayoutEffect 確保投票數即時儲存
  useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes));
    }
  }, [votes]);

  // ===== 視窗大小 & 容器縮放 =====
  // 固定初始值，避免 SSR/Hydration 差異
  const [vw, setVw] = useState<number>(1920);
  const [vh, setVh] = useState<number>(1080);
  const [scale, setScale] = useState(1); // 投票容器縮放（維持原邏輯）

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setVw(w);
      setVh(h);
      const sw = w / BASE_WIDTH;
      const sh = h / BASE_HEIGHT;
      setScale(Math.min(sw, sh, 1)); // 容器最大不超過 1
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 初始化時隨機決定「票數區」與「寶箱」各自的順序（之後改名稱不影響順序）
  useEffect(() => {
    const baseIndexes = items.map((_, idx) => idx); // [0,1,2,3]
    setShuffledItems(shuffle(baseIndexes));
    setChestGames(shuffle(baseIndexes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 遊戲名稱：Supabase 同步（像首頁公告一樣） =====
  const loadGamesFromSupabase = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from("vote_config")
        .select("id, games")
        .eq("id", 1)
        .single();

      if (error) {
        // 資料不存在：插入預設
        if ((error as any).code === "PGRST116") {
          const { error: insertError } = await supabase
            .from("vote_config")
            .insert({ id: 1, games: DEFAULT_GAMES, updated_by: "system" });

          if (!insertError) {
            setItems(DEFAULT_GAMES);
            saveGamesLocal(DEFAULT_GAMES);
            return;
          }
        }
        throw error;
      }

      const games = (data as any)?.games;
      if (isValidGames(games)) {
        setItems(games);
        saveGamesLocal(games);
        if (!isEditingNames && editingGameIndex === null) setDraftItems(games);
      } else {
        // 若資料格式不對，回退本地
        const local = loadGamesLocal();
        setItems(local);
        if (!isEditingNames && editingGameIndex === null) setDraftItems(local);
      }
    } catch (e) {
      console.warn("Failed to load vote_config from Supabase, fallback to localStorage", e);
      const local = loadGamesLocal();
      setItems(local);
      if (!isEditingNames && editingGameIndex === null) setDraftItems(local);
    }
  };

  const syncGamesToSupabase = async (games: string[]) => {
    // 先保留本地快取，避免回首頁再回來沒資料
    saveGamesLocal(games);

    if (!useSupabase || !supabase) return;
    try {
      const { data, error } = await supabase
        .from("vote_config")
        .update({ games })
        .eq("id", 1)
        .select("id");

      if (error) throw error;

      // RLS 或條件不匹配時可能造成 0 rows affected，但不一定會丟 error。
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(
          "寫入 Supabase 似乎沒有套用到任何資料（vote_config id=1）。\n" +
            "請確認你已在 Supabase 執行 db/rls_vote_config.sql，並允許 UPDATE。"
        );
      }
    } catch (e) {
      console.warn("Failed to update vote_config in Supabase, kept localStorage cache", e);
      throw e;
    }
  };

  // 初始化：決定是否使用 Supabase，並載入最新遊戲名稱
  useEffect(() => {
    if (hasSupabase && supabase) {
      setUseSupabase(true);
      void loadGamesFromSupabase();
    } else {
      setUseSupabase(false);
      const local = loadGamesLocal();
      setItems(local);
      setDraftItems(local);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime 訂閱：其他人改了遊戲名稱，這裡也要同步
  useEffect(() => {
    if (!useSupabase || !supabase) return;

    const channel = supabase
      .channel("public:vote_config")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vote_config", filter: "id=eq.1" },
        (payload) => {
          const next = (payload as any)?.new?.games;
          if (isValidGames(next)) {
            setItems(next);
            saveGamesLocal(next);
            if (!isEditingNames && editingGameIndex === null) setDraftItems(next);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [useSupabase, isEditingNames, editingGameIndex]);

  // ===== 背景小遊戲（以背景為容器縮放） =====
  const BG_BASE_WIDTH = 1920;
  const BG_BASE_HEIGHT = 1080;

  const PLAYER_SIZE = 80;
  const COIN_SIZE = 50;
  const MONSTER_SIZE = 90;

  const [playerPos, setPlayerPos] = useState({ x: 100, y: 100 }); // 基準座標
  const [coinPos, setCoinPos] = useState({ x: 400, y: 300 });     // 基準座標
  const [monsterPos, setMonsterPos] = useState({ x: 800, y: 500 });// 基準座標
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [playerAvatar, setPlayerAvatar] = useState("/game_04.png");

  // 速度參數（已調降）
  const MONSTER_BASE_SPEED = 150; // px / sec
  const SPEED_PER_SCORE   = 5;    // 每分加速
  const TURNING           = 0.22; // 轉向靈敏度
  const playerSpeed = 10;         // 玩家單次鍵盤位移（基準 px）

  // 讀取登入頭像
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mygame_user");
      if (!raw) return;
      const data = JSON.parse(raw);
      const u: string = data?.avatar || data?.image || data?.avatarUrl || data?.photoURL || "";
      if (u) {
        const url = normalizeAvatarUrl(u);
        const img = new Image();
        img.onload = () => setPlayerAvatar(url);
        img.onerror = () => setPlayerAvatar("/game_04.png");
        img.src = url;
      }
    } catch {}
  }, []);

  // === 投票容器矩形（viewport 座標）與禁區 ===
  const contW = BASE_WIDTH * scale;
  const contH = BASE_HEIGHT * scale;
  const contLeft = vw / 2 - contW / 2;
  const contTop = vh / 2 - contH / 2;
  const containerRect = { left: contLeft, top: contTop, right: contLeft + contW, bottom: contTop + contH };

  const AVOID_INSET_BASE = 140;
  const inset = Math.max(0, AVOID_INSET_BASE * scale);
  const avoidRectViewport = {
    left: containerRect.left + inset,
    top: containerRect.top + inset,
    right: containerRect.right - inset,
    bottom: containerRect.bottom - inset,
  };

  // === 背景縮放與對齊（以背景為容器） ===
  const bgScale = Math.min(vw / BG_BASE_WIDTH, vh / BG_BASE_HEIGHT);
  const bgW = BG_BASE_WIDTH * bgScale;
  const bgH = BG_BASE_HEIGHT * bgScale;
  const bgLeft = vw / 2 - bgW / 2; // 背景容器左上角（viewport 座標）
  const bgTop = vh / 2 - bgH / 2;

  // 將投票容器禁區由 viewport 轉成「背景基準座標」
  const avoidRectBase = {
    left: (avoidRectViewport.left - bgLeft) / bgScale,
    top: (avoidRectViewport.top - bgTop) / bgScale,
    right: (avoidRectViewport.right - bgLeft) / bgScale,
    bottom: (avoidRectViewport.bottom - bgTop) / bgScale,
  };

  // 讓精靈在視窗縮放時「維持原地」
  const prevBgRef = useRef<{left:number; top:number; scale:number; inited:boolean}>({
    left: bgLeft, top: bgTop, scale: bgScale, inited: false
  });

  function pushOutOfRect(
    x: number, y: number, w: number, h: number,
    rect: {left:number;top:number;right:number;bottom:number}
  ) {
    if (!intersectsRect(x, y, w, h, rect)) return { x, y };
    const cand = [
      { x: rect.left - w, y },
      { x: rect.right,    y },
      { x, y: rect.top - h },
      { x, y: rect.bottom }
    ].map(c => ({
      x: clamp(c.x, 0, BG_BASE_WIDTH - w),
      y: clamp(c.y, 0, BG_BASE_HEIGHT - h)
    }));
    const prev = prevBgRef.current;
    const prevVx = prev.left + x * prev.scale;
    const prevVy = prev.top  + y * prev.scale;
    let best = cand[0];
    let bestD = Infinity;
    for (const c of cand) {
      const vx = bgLeft + c.x * bgScale;
      const vy = bgTop  + c.y * bgScale;
      const d = (vx - prevVx) ** 2 + (vy - prevVy) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  useEffect(() => {
    const prev = prevBgRef.current;
    if (!prev.inited) {
      prev.inited = true;
      prev.left = bgLeft; prev.top = bgTop; prev.scale = bgScale;
      return;
    }

    const adjustEntity = (pos: {x:number;y:number}, size:number) => {
      const prevVx = prev.left + pos.x * prev.scale;
      const prevVy = prev.top  + pos.y * prev.scale;
      let nx = (prevVx - bgLeft) / bgScale;
      let ny = (prevVy - bgTop)  / bgScale;
      nx = clamp(nx, 0, BG_BASE_WIDTH - size);
      ny = clamp(ny, 0, BG_BASE_HEIGHT - size);
      return pushOutOfRect(nx, ny, size, size, avoidRectBase);
    };

    setPlayerPos(p => adjustEntity(p, PLAYER_SIZE));
    setMonsterPos(m => adjustEntity(m, MONSTER_SIZE));
    setCoinPos(c => adjustEntity(c, COIN_SIZE));

    prev.left = bgLeft; prev.top = bgTop; prev.scale = bgScale;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgLeft, bgTop, bgScale, avoidRectBase.left, avoidRectBase.top, avoidRectBase.right, avoidRectBase.bottom]);

  const avoidRectBaseRef = useRef(avoidRectBase);
  const gameOverRef = useRef(gameOver);
  const playerPosRef = useRef(playerPos);
  const scoreRef = useRef(score);
  const monsterVel = useRef({ vx: 0, vy: 0 });

  useEffect(() => { avoidRectBaseRef.current = avoidRectBase; }, [avoidRectBase]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // 玩家操作
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "r") {
        setPlayerPos(randomPosOutsideRectBase(PLAYER_SIZE, PLAYER_SIZE));
        setMonsterPos(randomPosOutsideRectBase(MONSTER_SIZE, MONSTER_SIZE));
        setCoinPos(randomPosOutsideRectBase(COIN_SIZE, COIN_SIZE));
        setScore(0);
        setGameOver(false);
        return;
      }
      if (gameOverRef.current) return;

      setPlayerPos((prev) => {
        let { x, y } = prev;
        const k = e.key.toLowerCase();
        let dx = 0, dy = 0;
        if (k === "arrowup" || k === "w") dy = -playerSpeed;
        if (k === "arrowdown" || k === "s") dy = playerSpeed;
        if (k === "arrowleft" || k === "a") dx = -playerSpeed;
        if (k === "arrowright" || k === "d") dx = playerSpeed;
        if (dx === 0 && dy === 0) return prev;

        let nx = clamp(x + dx, 0, BG_BASE_WIDTH - PLAYER_SIZE);
        let ny = clamp(y + dy, 0, BG_BASE_HEIGHT - PLAYER_SIZE);

        const rect = avoidRectBaseRef.current;
        if (intersectsRect(nx, ny, PLAYER_SIZE, PLAYER_SIZE, rect)) {
          const leftPos = rect.left - PLAYER_SIZE;
          const rightPos = rect.right;
          const topPos = rect.top - PLAYER_SIZE;
          const bottomPos = rect.bottom;
          const cand = [
            { x: clamp(leftPos, 0, BG_BASE_WIDTH - PLAYER_SIZE), y: ny },
            { x: clamp(rightPos, 0, BG_BASE_WIDTH - PLAYER_SIZE), y: ny },
            { x: nx, y: clamp(topPos, 0, BG_BASE_HEIGHT - PLAYER_SIZE) },
            { x: nx, y: clamp(bottomPos, 0, BG_BASE_HEIGHT - PLAYER_SIZE) },
          ];
          let best = cand[0];
          let bestD = Math.abs(best.x - x) + Math.abs(best.y - y);
          for (const c of cand.slice(1)) {
            const d = Math.abs(c.x - x) + Math.abs(c.y - y);
            if (d < bestD) { bestD = d; best = c; }
          }
          return best;
        }
        return { x: nx, y: ny };
      });
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerSpeed]);

  function randomPosOutsideRectBase(spriteW: number, spriteH: number) {
    const rect = avoidRectBaseRef.current;
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * (BG_BASE_WIDTH - spriteW);
      const y = Math.random() * (BG_BASE_HEIGHT - spriteH);
      if (!intersectsRect(x, y, spriteW, spriteH, rect)) return { x, y };
    }
    const leftSpace = Math.max(0, rect.left - spriteW - 10);
    if (leftSpace > 0) return { x: leftSpace, y: 10 };
    const belowY = rect.bottom + 10;
    return { x: 10, y: clamp(belowY, 0, BG_BASE_HEIGHT - spriteH) };
  }

  // 吃金幣
  useEffect(() => {
    if (gameOver) return;
    const dx = playerPos.x - coinPos.x;
    const dy = playerPos.y - coinPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 60) {
      setScore((s) => s + 1);
      setCoinPos(randomPosOutsideRectBase(COIN_SIZE, COIN_SIZE));
    }
  }, [playerPos, coinPos, gameOver]);

  // 怪物追逐
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!gameOverRef.current) {
        setMonsterPos((prev) => {
          const { vx, vy } = monsterVel.current;
          const p = playerPosRef.current;
          const rect = avoidRectBaseRef.current;

          const cx = prev.x + MONSTER_SIZE / 2;
          const cy = prev.y + MONSTER_SIZE / 2;
          const px = p.x + PLAYER_SIZE / 2;
          const py = p.y + PLAYER_SIZE / 2;
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.hypot(dx, dy) || 1;

          const speed = MONSTER_BASE_SPEED + Math.min(140, dist * 0.25) + SPEED_PER_SCORE * scoreRef.current;

          const desiredVx = (dx / dist) * speed;
          const desiredVy = (dy / dist) * speed;

          const newVx = vx + (desiredVx - vx) * TURNING;
          const newVy = vy + (desiredVy - vy) * TURNING;
          monsterVel.current = { vx: newVx, vy: newVy };

          let nx = clamp(prev.x + newVx * dt, 0, BG_BASE_WIDTH - MONSTER_SIZE);
          let ny = clamp(prev.y + newVy * dt, 0, BG_BASE_HEIGHT - MONSTER_SIZE);

          if (intersectsRect(nx, ny, MONSTER_SIZE, MONSTER_SIZE, rect)) {
            const leftPos = rect.left - MONSTER_SIZE;
            const rightPos = rect.right;
            const topPos = rect.top - MONSTER_SIZE;
            const bottomPos = rect.bottom;
            const cand = [
              { x: clamp(leftPos, 0, BG_BASE_WIDTH - MONSTER_SIZE), y: ny },
              { x: clamp(rightPos, 0, BG_BASE_WIDTH - MONSTER_SIZE), y: ny },
              { x: nx, y: clamp(topPos, 0, BG_BASE_HEIGHT - MONSTER_SIZE) },
              { x: nx, y: clamp(bottomPos, 0, BG_BASE_HEIGHT - MONSTER_SIZE) },
            ];
            let best = cand[0];
            let bestD = Math.abs(best.x - prev.x) + Math.abs(best.y - prev.y);
            for (const c of cand.slice(1)) {
              const d = Math.abs(c.x - prev.x) + Math.abs(c.y - prev.y);
              if (d < bestD) { bestD = d; best = c; }
            }
            nx = best.x; ny = best.y;
          }

          const ncx = nx + MONSTER_SIZE / 2;
          const ncy = ny + MONSTER_SIZE / 2;
          const distToPlayer = Math.hypot(ncx - px, ncy - py);
          if (distToPlayer < 40) setGameOver(true);

          return { x: nx, y: ny };
        });
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ===== 投票邏輯（原本保留） =====
  const handleVote = () => {
    if (selected === null) return;
    const votedIndex = chestGames[selected]; // 取得被選中的遊戲索引
    const idx = shuffledItems.indexOf(votedIndex); // 在票數區中的位置
    if (idx === -1) return;
    const newVotes = [...votes];
    newVotes[idx] += 1;
    setVotes(newVotes); // 更新 state 會觸發 useLayoutEffect 儲存
    setSelected(null);
  };

  // 🔧 編輯遊戲名稱（草稿）：只有按「儲存」才會同步到 Supabase
  const handleDraftNameChange = (index: number, value: string) => {
    setDraftItems((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleStartEditNames = () => {
    setDraftItems(items);
    setEditingGameIndex(null);
    setIsEditingNames(true);
  };

  const handleCancelEditNames = () => {
    setDraftItems(items);
    setIsEditingNames(false);
  };

  const handleSaveNames = async () => {
    const next = draftItems;
    if (!isValidGames(next)) return;
    setItems(next);
    try {
      await syncGamesToSupabase(next);
    } catch (e) {
      alert(`儲存失敗（已暫存本機）：${formatErrorMessage(e)}`);
    }
    setIsEditingNames(false);
  };

  const handleStartEditOne = (index: number) => {
    setIsEditingNames(false);
    setDraftItems(items);
    setEditingGameIndex(index);
  };

  const handleCancelEditOne = () => {
    setDraftItems(items);
    setEditingGameIndex(null);
  };

  const handleSaveOne = async (index: number) => {
    const raw = (draftItems[index] ?? "").trim();
    if (!raw) {
      alert("遊戲名稱不能為空");
      return;
    }

    const next = [...items];
    next[index] = raw;

    if (!isValidGames(next)) {
      alert("遊戲名稱格式不正確");
      return;
    }

    setItems(next);
    try {
      await syncGamesToSupabase(next);
    } catch (e) {
      alert(`儲存失敗（已暫存本機）：${formatErrorMessage(e)}`);
    }
    setDraftItems(next);
    setEditingGameIndex(null);
  };
  
  // 🔑 新增：重新投票函數
  const handleResetVotes = () => {
    if (window.confirm("確定要將所有投票數重設為零嗎？此操作不可恢復。")) {
      setVotes(DEFAULT_VOTES); // 重設為 [0, 0, 0, 0]，觸發 useLayoutEffect 儲存
      setSelected(null);
      alert("投票數已重設！");
    }
  };

  // ======== 這裡開始是畫面 ========
  // 以背景為容器的提示文字
  const BG_TEXT_TOP_PX = 24;        // 固定距離「背景頂端」的基準 px
  const TEXT_BASE_WIDTH = 900;
  const TEXT_BASE_FONT = 22;

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      {/* 最底層背景（滿版） */}
      <img
        src="/game_11.png"
        alt="背景"
        style={{ position: "absolute", inset: 0, width: "100vw", height: "100vh", objectFit: "cover", zIndex: -1 }}
        draggable={false}
      />

      {/* 背景小遊戲層（以背景為容器縮放；位置在縮放時維持原地） */}
      <div
        style={{
          position: "absolute",
          left: bgLeft,
          top: bgTop,
          width: BG_BASE_WIDTH,
          height: BG_BASE_HEIGHT,
          transform: `scale(${bgScale})`,
          transformOrigin: "top left",
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {/* 玩家 */}
        <img
          src={playerAvatar}
          alt="玩家"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/game_04.png"; }}
          style={{ position: "absolute", left: playerPos.x, top: playerPos.y, width: PLAYER_SIZE, height: PLAYER_SIZE, borderRadius: "50%" }}
          draggable={false}
        />

        {/* 金幣 */}
        <img
          src="/coin.png"
          alt="錢幣"
          style={{ position: "absolute", left: coinPos.x, top: coinPos.y, width: COIN_SIZE, height: COIN_SIZE }}
          draggable={false}
        />

        {/* 怪物 */}
        <img
          src="/monster.png"
          alt="怪物"
          style={{ position: "absolute", left: monsterPos.x, top: monsterPos.y, width: MONSTER_SIZE, height: MONSTER_SIZE }}
          draggable={false}
        />
      </div>

      {/* 分數（保留在視窗左上角） */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          color: "#fff",
          background: "rgba(0,0,0,0.6)",
          padding: "6px 12px",
          borderRadius: 8,
          fontWeight: 700,
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        分數：{score}（按 R 重新開始）
      </div>

      {/* === 以背景為容器的上方文字（位置跟著背景、大小跟著背景縮放；不再遮擋投票區） === */}
      <div
        style={{
          position: "absolute",
          // 以「背景中心」為水平基準，確保縮放時仍置中
          left: bgLeft + (BG_BASE_WIDTH * bgScale) / 2,
          // 以「背景頂端」為垂直基準，加入基準位移（之前的 +45 也保留）
          top: bgTop + (BG_TEXT_TOP_PX + 10) * bgScale,
          transform: "translateX(-50%)",
          zIndex: 2,               // 文字層在投票容器(zIndex:1)之上，避免被蓋住
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            transform: `scale(${bgScale})`,
            transformOrigin: "top center",
            width: TEXT_BASE_WIDTH,
            color: "#fff",
            fontWeight: 800,
            fontSize: `${TEXT_BASE_FONT}px`,
            lineHeight: 1.4,
            textAlign: "center",
            textShadow: "0 2px 6px rgba(0,0,0,0.7)",
            whiteSpace: "normal",
            overflow: "hidden",
            display: "-webkit-box" as any,
            WebkitLineClamp: 3 as any,
            WebkitBoxOrient: "vertical" as any,
          }}
        >
          使用方向鍵 / WASD 移動
          <br />
          您的頭像去吃金幣，並且避開寶箱怪的碰觸，每吃一個金幣得一分，分數會顯示在左上角，按 R 可重新開始挑戰
        </div>
      </div>

      {/* ===== 前景：你的投票容器（原本程式碼，未更動） ===== */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          backgroundImage: "url(/game_10.png)",
          backgroundSize: "100% 100%",
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        {/* 四個寶箱 */}
        <div
          style={{
            position: "absolute",
            top: "250px",
            left: "50%",
            width: "880px",
            height: "210px",
            transform: "translateX(-50%) scale(0.9)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "auto",
          }}
        >
          {chestGames.map((itemIndex, i) => (
            (() => {
              const name = items[itemIndex] ?? "";
              return (
            <div
              key={i}
              style={{
                width: "210px",
                height: "210px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              onClick={() => setSelected(i)}
            >
              <img
                src={`/chest_${i + 1}.png`}
                alt={name}
                style={{ width: "210px", height: "auto", pointerEvents: "auto" }}
              />
              {selected === i && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "-48px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.8)",
                    color: "#fff",
                    fontSize: "1.3rem",
                    fontWeight: "bold",
                    padding: "8px 24px",
                    borderRadius: "12px",
                    whiteSpace: "nowrap",
                    zIndex: 10,
                    pointerEvents: "auto",
                  }}
                >
                  {name}
                </div>
              )}
            </div>
              );
            })()
          ))}
        </div>

        {/* 投票按鈕 */}
        <img
          src="/button_vote.png"
          alt="投票"
          onClick={handleVote}
          style={{
            position: "absolute",
            left: "260px",
            top: "520px",
            width: "260px",
            height: "50px",
            cursor: "pointer",
          }}
        />

        {/* 回首頁按鈕 */}
      <img
        src="/button_home.png"
        alt="回首頁"
        onClick={() => {
          try {
            const loggedIn = localStorage.getItem("mygame_loggedIn") === "true";
            const raw = localStorage.getItem("mygame_user");
            const parsed = raw ? JSON.parse(raw) : {};

            if (loggedIn && parsed) {
              const current =
                parsed?.avatar ||
                parsed?.image ||
                parsed?.avatarUrl ||
                parsed?.photoURL ||
                (typeof playerAvatar === "string" ? playerAvatar : "") ||
                "/game_04.png";

              localStorage.setItem(
                "mygame_user",
                JSON.stringify({ ...parsed, image: current, avatar: current })
              );
            }
          } catch (e) {
            console.warn("回首頁時同步頭像失敗", e);
          }

          if (typeof window !== "undefined") window.location.assign("/");
        }}
        style={{
          position: "absolute",
          left: "260px",
          top: "585px",
          width: "260px",
          height: "50px",
          cursor: "pointer",
        }}
        draggable={false}
      />

        {/* 🔑 重新投票按鈕 (樣式已修正) */}
        <button
            onClick={handleResetVotes}
            style={{
                position: "absolute",
                left: "260px",
                top: "715px", // 調整位置往下
                width: "140px", // 縮小寬度 (原本 260px)
                height: "50px",
                cursor: "pointer",
                background: "rgba(255, 255, 255, 0.4)", // 白色半透明背景
                border: "1px solid white", // 白色邊框再調細
                borderRadius: "10px",
                color: "#333", // 深色文字確保可讀性
                fontSize: "18px",
                fontWeight: "bold",
                fontFamily: "sans-serif", 
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textShadow: "0 0 5px rgba(255,255,255,0.7)", // 淺色陰影
            }}
        >
            重新投票
        </button>


          {/* 票數區 */}
        <div
          style={{
            position: "absolute",
            left: "570px",
            top: "485px",
            width: "540px",
            height: "160px",
            transform: "scale(0.8)",
            transformOrigin: "left top",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
            {shuffledItems.map((itemIndex, i) => {
              const canEditThis = isEditingNames;
              const name = (canEditThis ? draftItems[itemIndex] : items[itemIndex]) ?? "";
              return (
            <div
              key={i}
              style={{
                width: "120px",
                textAlign: "center",
                position: "relative",
              }}
            >
              <div style={{ position: "relative", width: "100px", height: "100px", margin: "0 auto" }}>
                <img
                  src={`/score_${i + 1}.png`}
                  alt={name || `score_${i + 1}`}
                  style={{
                    width: "100px",
                    height: "100px",
                    display: "block",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: "2px",
                    bottom: "2px",
                    fontSize: "28px",
                    color: "#ffd700",
                    fontWeight: "bold",
                    textShadow: "0 2px 8px #333",
                    borderRadius: "6px",
                    padding: "2px 8px",
                    pointerEvents: "none",
                  }}
                >
                  {votes[i]}
                </span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  if (!canEditThis) return;
                  handleDraftNameChange(itemIndex, e.target.value);
                }}
                disabled={!canEditThis}
                style={{
                  marginTop: "8px",
                  width: "100%",
                  padding: "2px 4px",
                  borderRadius: 6,
                  border: "1px solid #ffffff",
                  background: canEditThis ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.28)",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: "bold",
                  textAlign: "center",
                  textShadow: "0 2px 8px #333",
                  cursor: canEditThis ? "text" : "not-allowed",
                }}
                placeholder={`遊戲 ${itemIndex + 1} 名稱`}
              />
            </div>
            );
          })}
        </div>

        {/* 遊戲名稱：編輯/儲存 */}
        <div
          style={{
            position: "absolute",
            left: "420px", // 移到重新投票按鈕右側 (260 + 140 + 20)
            top: "715px",  // 對齊重新投票按鈕高度
            width: "auto",
            // 移除 scale，讓大小跟重新投票按鈕一致
            transform: "none", 
            transformOrigin: "left top",
            display: "flex",
            justifyContent: "flex-start",
            gap: "14px",
            pointerEvents: "auto",
          }}
        >
          {!isEditingNames ? (
            <button
              onClick={handleStartEditNames}
              style={{
                padding: "0 16px", // 調整 padding 配合高度
                height: "50px",    // 固定高度 50px
                borderRadius: 10,
                border: "1px solid white",
                background: "rgba(255, 255, 255, 0.35)",
                color: "#222",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              編輯遊戲名稱
            </button>
          ) : (
            <>
              <button
                onClick={handleSaveNames}
                style={{
                  padding: "0 16px",
                  height: "50px",
                  borderRadius: 10,
                  border: "1px solid white",
                  background: "rgba(144, 238, 144, 0.55)",
                  color: "#1b1b1b",
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                儲存
              </button>
              <button
                onClick={handleCancelEditNames}
                style={{
                  padding: "0 16px",
                  height: "50px",
                  borderRadius: 10,
                  border: "1px solid white",
                  background: "rgba(255, 255, 255, 0.35)",
                  color: "#222",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                取消
              </button>
            </>
          )}

          <div
            style={{
              display: "none",
            }}
          >
            {useSupabase ? "🟢 Supabase 同步" : "🟡 本機暫存"}
          </div>
        </div>
      </div>
    </div>
  );
}