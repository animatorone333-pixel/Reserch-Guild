"use client";
import { useState, useEffect } from "react";
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
const SHEET_API_URL = "/api/shop"; 
const GRID_SIZE = 12;
const SHOP_ITEMS_STORAGE_KEY = "shop_page_items_v1";
const STORAGE_BUCKET = "shop-images";

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

// localStorage 載入函數（Fallback）
const loadPersistedItems = (): ShopItem[] => {
  if (typeof window === 'undefined') return createInitialItems();
  
  const storedJson = localStorage.getItem(SHOP_ITEMS_STORAGE_KEY);
  if (storedJson) {
    try {
      const parsedItems: any[] = JSON.parse(storedJson);
      
      if (Array.isArray(parsedItems) && parsedItems.length === GRID_SIZE) {
        return parsedItems.map((item, index) => ({
          id: typeof item.id === "number" ? item.id : index,
          position: index,
          name: typeof item.name === "string" ? item.name : "",
          image: null,
          preview: typeof item.preview === "string" ? item.preview : null,
          imageUrl: "",
        }));
      }
    } catch (e) {
      console.error("Failed to parse stored items:", e);
    }
  }
  return createInitialItems();
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

  // === 從 Supabase 載入商品 ===
  const loadFromSupabase = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;

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
        console.log("✅ 從 Supabase 載入商品成功");
      }
    } catch (error) {
      console.error("❌ 從 Supabase 載入失敗:", error);
      setItems(loadPersistedItems());
    }
  };

  // === 初始化 ===
  useEffect(() => {
    const initialize = async () => {
      if (initializedData) return;
      if (hasSupabase && !supabase) return;

      if (hasSupabase && supabase) {
        setUseSupabase(true);
        await loadFromSupabase();
      } else {
        setUseSupabase(false);
        const loaded = loadPersistedItems();
        setItems(loaded);
      }
      setItemsLoaded(true);
      setInitializedData(true);
    };

    initialize();
  }, [hasSupabase, supabase, initializedData]);

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
  }, [useSupabase]);

  // === localStorage 持久化（Fallback） ===
  useEffect(() => {
    if (!itemsLoaded || useSupabase) return;
    
    const itemsToPersist = items.map(({ id, name, preview, position }) => ({ 
      id, 
      name, 
      preview,
      position 
    }));
    localStorage.setItem(SHOP_ITEMS_STORAGE_KEY, JSON.stringify(itemsToPersist));
  }, [items, itemsLoaded, useSupabase]); 

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
        // 更新資料庫
        const { error } = await supabase
          .from('shop_items')
          .upsert({
            position: index,
            image_url: imageUrl,
            item_name: items[index].name,
            user_id: 'guest'
          }, {
            onConflict: 'position'
          });

        if (error) {
          console.error("❌ 更新資料庫失敗:", error);
        } else {
          // 更新本地狀態
          setItems((prev) => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              imageUrl: imageUrl,
            };
            return next;
          });
        }
      }
    }
  };

  // === 處理名稱變更 ===
  const handleNameChange = async (index: number, value: string) => {
    // 樂觀更新
    setItems(prev => {
      const next = [...prev];
      next[index].name = value;
      return next;
    });

    // 如果使用 Supabase，同步到資料庫
    if (useSupabase && supabase) {
      const { error } = await supabase
        .from('shop_items')
        .upsert({
          position: index,
          item_name: value,
          image_url: items[index].imageUrl || '',
          user_id: 'guest'
        }, {
          onConflict: 'position'
        });

      if (error) {
        console.error("❌ 更新名稱失敗:", error);
      }
    }
  };

  // === 送出（Fallback 模式使用） ===
  const handleSubmit = async () => {
    if (useSupabase) {
      alert("✅ 資料已即時同步到 Supabase！");
      return;
    }

    // Fallback: 使用 Google Sheets API
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      items.forEach((item, i) => {
        formData.append(`item${i}_name`, item.name);
        formData.append(`item${i}_image`, item.image || ""); 
      });

      const response = await fetch(SHEET_API_URL, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        alert("✅ 已成功上傳到 Google Sheet！");
      } else {
        const errorText = await response.text();
        console.error(`❌ 上傳失敗: HTTP ${response.status}`, errorText);
        alert(`❌ 上傳失敗 (HTTP ${response.status})，請檢查後端服務。`);
      }
    } catch (error) {
      console.error("❌ 上傳失敗", error);
      alert("❌ 上傳失敗，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
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
      // Fallback: 清除 localStorage
      const empty = createInitialItems();
      setItems(empty);
      localStorage.removeItem(SHOP_ITEMS_STORAGE_KEY);
    }
  };

  return (
    <main className={styles.wrapper}>
      {/* 資料來源指示器 */}
      <div style={{ 
        position: 'fixed', 
        top: '10px', 
        right: '10px', 
        background: useSupabase ? '#4CAF50' : '#FF9800',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
        zIndex: 1000
      }}>
        {useSupabase ? '🟢 Supabase' : '🟡 Fallback'}
      </div>

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
                  <img 
                    src={item.preview || item.imageUrl} 
                    alt="預覽" 
                    className={styles.preview} 
                  />
                ) : (
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
                )}
              </div>
              <input
                type="text"
                placeholder="請輸入名稱..."
                value={item.name}
                onChange={(e) => handleNameChange(i, e.target.value)}
                className={styles.nameInput}
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
          }}
        >
          {!useSupabase && (
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "上傳中..." : "送出"}
            </button>
          )}
          <button
            className={styles.clearBtn}
            onClick={handleClearAll}
          >
            清除欄位
          </button>
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
