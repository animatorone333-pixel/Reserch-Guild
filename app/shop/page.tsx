"use client";
import { useState, useEffect, useCallback } from "react";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase 設定
const ENV_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ENV_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const initialHasSupabase = ENV_SUPABASE_URL !== "" && ENV_SUPABASE_ANON_KEY !== "";
const initialSupabase: SupabaseClient | null = initialHasSupabase
  ? createClient(ENV_SUPABASE_URL, ENV_SUPABASE_ANON_KEY)
  : null;

// Fallback API
const GRID_SIZE = 12;
const STORAGE_BUCKET = "shop-images";

const SHOP_SETUP_HINT =
  "常見原因：RLS/權限未設定或 Storage bucket/policy 未建立。\n" +
  "請確認已在 Supabase SQL Editor 執行修復腳本：\n" +
  "- db/fix_shop_permissions.sql\n" +
  "（此腳本會修復 Sequence 權限並補齊初始資料）\n" +
  "並建立 Storage bucket：shop-images（含 INSERT/SELECT/UPDATE/DELETE policies）。";

// 舞台基準尺寸
const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const MIN_SCALE_THRESHOLD = 0.9;

// 定義 Item 類型
type ShopItem = {
  id: number;
  position: number;
  name: string;
  image: File | null;
  preview: string | null;
  imageUrl?: string; // Supabase Storage URL
}

// 基礎初始化函數
const createInitialItems = (): ShopItem[] => {
  return Array.from({ length: GRID_SIZE }, (_, i) => ({
    id: i,
    position: i,
    name: "",
    image: null,
    preview: null,
    imageUrl: "",
  }));
};

const formatErrorMessage = (err: unknown): string => {
  if (!err) return "未知錯誤";

  if (typeof err === "string") return err;

  const anyErr = err as any;

  // Supabase/PostgREST error 常見欄位：message/details/hint/code
  const message =
    (typeof anyErr?.message === "string" && anyErr.message) ||
    (typeof anyErr?.error_description === "string" && anyErr.error_description) ||
    (typeof anyErr?.error === "string" && anyErr.error) ||
    "";
  const details = typeof anyErr?.details === "string" ? anyErr.details : "";
  const hint = typeof anyErr?.hint === "string" ? anyErr.hint : "";
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";

  const parts = [
    code ? `code=${code}` : "",
    message,
    details ? `details=${details}` : "",
    hint ? `hint=${hint}` : "",
  ].filter(Boolean);

  return parts.join("\n");
};

const buildShopSaveHint = (err: unknown): string | null => {
  const msg = formatErrorMessage(err).toLowerCase();

  if (
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("permission denied") ||
    msg.includes("shop_items")
  ) {
    return SHOP_SETUP_HINT;
  }

  if (msg.includes("shop-images") || msg.includes("storage") || msg.includes("bucket")) {
    return SHOP_SETUP_HINT;
  }

  return null;
};

export default function ShopPage() {
  const router = useRouter();

  const [hasSupabase, setHasSupabase] = useState(initialHasSupabase);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(initialSupabase);
  const [initializedData, setInitializedData] = useState(false);
  
  const [items, setItems] = useState<ShopItem[]>(createInitialItems());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scale, setScale] = useState(1);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [useSupabase, setUseSupabase] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [supabaseConfigSource, setSupabaseConfigSource] = useState<"build" | "runtime" | "none">(
    initialHasSupabase ? "build" : "none"
  );
  const [supabaseUrlUsed, setSupabaseUrlUsed] = useState<string | null>(initialHasSupabase ? ENV_SUPABASE_URL : null);
  const [debugMode, setDebugMode] = useState(false);

  const supabaseReady = hasSupabase && !!supabase;

  const getProjectRefFromUrl = (url: string | null): string | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname || "";
      // e.g. https://xxxx.supabase.co -> xxxx
      const first = host.split(".")[0];
      return first || null;
    } catch {
      return null;
    }
  };
  const supabaseProjectRef = getProjectRefFromUrl(supabaseUrlUsed);

  // 若 build-time NEXT_PUBLIC_* 沒被內嵌，從 server runtime 取得設定並初始化 Supabase。
  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      if (initialHasSupabase) return;
      try {
        const res = await fetch("/api/supabase-config", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (json?.hasSupabase && typeof json.url === "string" && typeof json.anonKey === "string") {
          setHasSupabase(true);
          setSupabase(createClient(json.url, json.anonKey));
          setSupabaseConfigSource("runtime");
          setSupabaseUrlUsed(json.url);
        }
      } catch {
        // ignore and keep fallback
      }
    };
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      setDebugMode(new URLSearchParams(window.location.search).get("debug") === "1");
    } catch {
      setDebugMode(false);
    }
  }, []);

  // === 從 Supabase 載入商品 ===
  const loadFromSupabase = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;

      // 檢查是否為空資料表，若是則自動初始化 (Seeding)
      if (data && data.length === 0) {
        console.log("⚠️ Shop items 為空，嘗試自動初始化 12 個格子...");
        const initialData = Array.from({ length: GRID_SIZE }, (_, i) => ({
          position: i,
          item_name: '',
          image_url: '',
          user_id: 'guest',
        }));

        const { error: seedError } = await supabase
          .from('shop_items')
          .upsert(initialData, { onConflict: 'position' });
        
        if (seedError) {
          console.error("❌ 自動初始化失敗:", seedError);
          // 不拋出錯誤，讓使用者繼續看到空介面，但 Console 會有紀錄
        } else {
          console.log("✅ 自動初始化成功，重新載入...");
          // 遞迴呼叫自己重新讀取 (需小心無限迴圈，但理論上現在有資料了)
          // 但為了安全起見，直接手動設值即可，不用再 fetch
          setItems(createInitialItems());
          return;
        }
      }

      if (data) {
        const loadedItems = createInitialItems();
        data.forEach(item => {
          if (item.position >= 0 && item.position < GRID_SIZE) {
            loadedItems[item.position] = {
              id: item.id,
              position: item.position,
              name: item.item_name || '',
              image: null,
              preview: item.image_url || null,
              imageUrl: item.image_url || '',
            };
          }
        });
        setItems(loadedItems);
        // 如果實際載入筆數 > 0，才算載入成功
        if (data.length > 0) {
           console.log("✅ 從 Supabase 載入商品成功");
        }
      }
    } catch (error) {
      console.error("❌ 從 Supabase 載入失敗:", error);
      // Supabase-only：載入失敗就維持預設空資料，並讓錯誤在 console 可見
      setItems(createInitialItems());
    }
  }, [supabase]);

  // === 初始化 ===
  useEffect(() => {
    const initialize = async () => {
      if (initializedData) return;
      if (hasSupabase && !supabase) return;

      // Supabase-only：只允許 Supabase
      if (hasSupabase && supabase) {
        setUseSupabase(true);
        await loadFromSupabase();
      } else {
        setUseSupabase(false);
        setItems(createInitialItems());
      }
      setItemsLoaded(true);
      setInitializedData(true);
    };

    initialize();
  }, [hasSupabase, supabase, initializedData, loadFromSupabase]);

  // === Supabase Realtime 訂閱 ===
  useEffect(() => {
    if (!useSupabase || !supabase) return;

    const channel = supabase
      .channel('public:shop_items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_items' },
        (payload) => {
          console.log('📡 Shop items 變更:', payload);
          loadFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [useSupabase, supabase, loadFromSupabase]);

  // === 縮放效果 ===
  useEffect(() => {
    const handleResize = () => {
      const windowW = window.innerWidth;
      const windowH = window.innerHeight;
      const scaleX = windowW / BASE_WIDTH;
      const scaleY = windowH / BASE_HEIGHT;
      let s = Math.min(scaleX, scaleY);
      if (s < MIN_SCALE_THRESHOLD) s = MIN_SCALE_THRESHOLD;
      setScale(s);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // === 上傳圖片到 Supabase Storage ===
  const uploadImageToSupabase = async (file: File, position: number): Promise<string | null> => {
    if (!supabase) return null;

    try {
      // 生成唯一檔名
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${position}_${timestamp}.${fileExt}`;

      // 先刪除舊圖片（如果有）
      const currentItem = items[position];
      if (currentItem.imageUrl) {
        const oldFileName = currentItem.imageUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([oldFileName]);
        }
      }

      // 上傳新圖片
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // 取得公開 URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("❌ 上傳圖片失敗:", error);
      return null;
    }
  };

  // === 處理圖片變更 ===
  const handleImageChange = async (index: number, file: File) => {
    // 先產生本地預覽（樂觀更新）
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string | null;
      if (!result) return;

      setItems((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          image: file,
          preview: result,
        };
        return next;
      });
    };
    reader.readAsDataURL(file);

    // 如果使用 Supabase，上傳圖片
    if (useSupabase && supabase) {
      const imageUrl = await uploadImageToSupabase(file, index);
      
      if (imageUrl) {
        // 使用 upsert 更新資料庫（需確保 db/fix_shop_permissions.sql 已執行）
        try {
          const itemName = items[index]?.name ?? "";
          const { error } = await supabase
            .from('shop_items')
            .upsert(
              {
                position: index,
                image_url: imageUrl,
                item_name: itemName,
                user_id: 'guest',
              },
              { onConflict: 'position' }
            );

          if (error) throw error;

          // 更新本地狀態
          setItems((prev) => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              imageUrl: imageUrl,
            };
            return next;
          });
        } catch (e) {
          console.error("❌ 更新資料庫失敗:", e);
          const extra = buildShopSaveHint(e);
          alert(`❌ 圖片儲存到 Supabase 失敗：\n${formatErrorMessage(e)}${extra ? `\n\n${extra}` : ""}`);
        }
      }
    }
  };

  // === 處理名稱變更 ===
  const handleNameChange = (index: number, value: string) => {
    // 僅更新本地狀態，儲存變更時再同步
    setItems(prev => {
      const next = [...prev];
      next[index].name = value;
      return next;
    });
  };

  // === 切換編輯模式 / 儲存 ===
  const handleToggleEdit = async () => {
    if (isEditing) {
      // 從編輯模式切換回檢視模式 -> 執行儲存
      if (useSupabase && supabase) {
        setIsSubmitting(true);
        try {
          const updates = items.map((item) => ({
            position: item.position,
            item_name: item.name,
            image_url: item.imageUrl || '',
            user_id: 'guest',
          }));

          // 用 UPSERT 批次寫入，更原子化與高效
          // (需確保 db/fix_shop_permissions.sql 已執行，解決 Sequence 權限問題)
          const { error } = await supabase
            .from('shop_items')
            .upsert(updates, { onConflict: 'position' });

          if (error) throw error;

          // 儲存後再讀回一次，避免「看起來沒同步」其實是本地狀態/快取問題
          await loadFromSupabase();
          alert("✅ 資料已同步到 Supabase！");
        } catch (error) {
          console.error("❌ 儲存失敗:", error);
          const extra = buildShopSaveHint(error);
          alert(`❌ 儲存失敗：\n${formatErrorMessage(error)}${extra ? `\n\n${extra}` : ""}`);
        } finally {
          setIsSubmitting(false);
        }
      }
      setIsEditing(false);
    } else {
      // 進入編輯模式
      setIsEditing(true);
    }
  };

  // === 送出（Fallback 模式使用） ===
  const handleSubmit = async () => {
    // Supabase-only：不提供 fallback submit
    alert("此頁面目前只支援 Supabase 模式，請先設定 Supabase。");
  };

  // === 清除所有欄位 ===
  const handleClearAll = async () => {
    if (!window.confirm("確定要清除所有圖片與名稱嗎？")) return;

    if (useSupabase && supabase) {
      try {
        // 刪除所有 Storage 中的圖片
        const { data: files } = await supabase.storage
          .from(STORAGE_BUCKET)
          .list();

        if (files && files.length > 0) {
          const fileNames = files.map(f => f.name);
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove(fileNames);
        }

        // 清空資料庫
        await supabase
          .from('shop_items')
          .update({ item_name: '', image_url: '' })
          .gte('position', 0);

        alert("✅ 已清除所有資料");
      } catch (error) {
        console.error("❌ 清除失敗:", error);
        alert("❌ 清除失敗，請稍後再試");
      }
    } else {
      // Supabase-only：無 Supabase 時仍允許清空畫面，但不會寫入任何地方
      const empty = createInitialItems();
      setItems(empty);
    }
  };

  return (
    <main className={styles.wrapper}>
      {debugMode && (
        <div
          style={{
            position: "fixed",
            left: 12,
            top: 12,
            zIndex: 1000,
            maxWidth: 420,
            padding: 12,
            borderRadius: 12,
            background: "rgba(0,0,0,0.72)",
            color: "#fff",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Shop Debug</div>
          <div>supabaseReady: {String(supabaseReady)}</div>
          <div>hasSupabase: {String(hasSupabase)}</div>
          <div>configSource: {supabaseConfigSource}</div>
          <div>projectRef: {supabaseProjectRef ?? "(unknown)"}</div>
          <div style={{ opacity: 0.9, wordBreak: "break-all" }}>url: {supabaseUrlUsed ?? "(none)"}</div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>
            若你在 Supabase Dashboard 看的不是這個 projectRef，就會覺得「沒同步」。
          </div>
        </div>
      )}
      {!supabaseReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            textAlign: "left",
          }}
        >
          <div style={{ maxWidth: 720, background: "rgba(0,0,0,0.55)", padding: 18, borderRadius: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>需要設定 Supabase 才能使用商店</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14 }}>
              {"請先設定 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY，並完成 shop_items 與 Storage bucket 的設定。\n\n" +
                SHOP_SETUP_HINT}
            </div>
          </div>
        </div>
      )}
      {/* 書本背景 */}
      <div
        style={{
          position: "relative",
          width: `${BASE_WIDTH * scale}px`,
          height: `${BASE_HEIGHT * scale}px`,
        }}
      >
        <img
          src="/game_19.png"
          alt="推薦購買背景"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            pointerEvents: "none",
          }}
        />

        {/* 欄框區 */}
        <div
          className={styles.container}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -55%)",
          }}
        >
          {items.map((item, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.imageBox}>
                {item.preview || item.imageUrl ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img 
                      src={item.preview || item.imageUrl} 
                      alt="預覽" 
                      className={styles.preview} 
                    />
                    {isEditing && (
                      <label 
                        className={styles.uploadLabel} 
                        style={{ 
                          position: 'absolute', 
                          bottom: 0, 
                          left: 0, 
                          right: 0, 
                          top: 0, 
                          opacity: 0, 
                          cursor: 'pointer' 
                        }}
                        title="點擊更換圖片"
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleImageChange(i, e.target.files[0]);
                            }
                          }}
                          hidden
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  isEditing ? (
                    <label className={styles.uploadLabel}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageChange(i, e.target.files[0]);
                          }
                        }}
                        hidden
                      />
                      上傳圖片
                    </label>
                  ) : (
                    <div className={styles.uploadLabel} style={{ cursor: 'default', opacity: 0.5 }}>
                      尚無商品
                    </div>
                  )
                )}
              </div>
              <input
                type="text"
                placeholder={isEditing ? "請輸入名稱..." : ""}
                value={item.name}
                onChange={(e) => handleNameChange(i, e.target.value)}
                className={styles.nameInput}
                disabled={!isEditing}
                style={{
                  backgroundColor: isEditing ? 'white' : 'transparent',
                  border: isEditing ? '1px solid #ccc' : 'none',
                  textAlign: 'center'
                }}
              />
            </div>
          ))}
        </div>

        {/* 下方按鈕列 */}
        <div
          className={styles.bottomBar}
          style={{
            position: "absolute",
            left: "50%",
            bottom: "40px",
            transform: "translateX(-50%)",
            zIndex: 100,
            display: "flex",
            gap: "10px",
            width: "100%",
            justifyContent: "center"
          }}
        >
          {/* 編輯模式按鈕 */}
          <button
            className={styles.submitBtn}
            onClick={handleToggleEdit}
            style={{ 
              backgroundColor: isEditing ? (useSupabase ? '#4CAF50' : '#2196F3') : '#FF9800',
            }}
            disabled={isSubmitting || !supabaseReady}
          >
            {isEditing ? (useSupabase ? "儲存變更" : "完成編輯") : "編輯模式"}
          </button>

          {/* 清除按鈕 */}
          <button
            className={styles.clearBtn}
            onClick={handleClearAll}
            disabled={!supabaseReady}
          >
            清除欄位
          </button>

          {/* 回首頁按鈕 */}
          <button
            className={styles.homeBtn}
            onClick={() => router.push("/")}
          >
            回首頁
          </button>
        </div>
      </div>
    </main>
  );
}
