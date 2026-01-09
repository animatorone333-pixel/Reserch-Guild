"use client";
import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";

const SHEET_API_URL = "/api/shop"; 
const GRID_SIZE = 12;

// 舞台基準尺寸：讓欄框和中間書本一起等比例縮放
const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const MIN_SCALE_THRESHOLD = 0.9;

// 🆕 儲存鍵
const SHOP_ITEMS_STORAGE_KEY = "shop_page_items_v1";

// 定義 Item 類型
type ShopItem = {
  id: number;
  name: string;
  image: File | null;
  preview: string | null;
}

// 基礎初始化函數
const createInitialItems = (): ShopItem[] => {
  return Array.from({ length: GRID_SIZE }, (_, i) => ({
    id: i,
    name: "",
    image: null,
    preview: null,
  }));
};

// 🆕 載入持久化資料函數
// 這裡只從 localStorage 還原文字資料與 base64 預覽圖，不還原 File 物件
const loadPersistedItems = (): ShopItem[] => {
  if (typeof window === 'undefined') return createInitialItems();
  
  const storedJson = localStorage.getItem(SHOP_ITEMS_STORAGE_KEY);
  if (storedJson) {
    try {
      const parsedItems: any[] = JSON.parse(storedJson);
      
      if (Array.isArray(parsedItems) && parsedItems.length === GRID_SIZE) {
        return parsedItems.map((item, index) => ({
          id: typeof item.id === "number" ? item.id : index,
          name: typeof item.name === "string" ? item.name : "",
          image: null,                                  // File 需重新選擇
          preview: typeof item.preview === "string"    // base64 或 URL 字串
            ? item.preview
            : null,
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
  
  // 狀態初始化：先用固定空欄位，避免 SSR / Client 初始內容不同
  const [items, setItems] = useState<ShopItem[]>(createInitialItems());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scale, setScale] = useState(1);
  const [itemsLoaded, setItemsLoaded] = useState(false);

  // 客戶端掛載後，再從 localStorage 載入實際內容（含預覽圖）
  useEffect(() => {
    const loaded = loadPersistedItems();
    setItems(loaded);
    setItemsLoaded(true);
  }, []);

  // 監聽 items 變化並儲存到 localStorage（等載入完成後再開始覆寫）
  useEffect(() => {
    if (!itemsLoaded) return;
    // 儲存時，只存可序列化的欄位：id、name、preview（base64/URL 字串）
    const itemsToPersist = items.map(({ id, name, preview }) => ({ id, name, preview }));
    localStorage.setItem(SHOP_ITEMS_STORAGE_KEY, JSON.stringify(itemsToPersist));
  }, [items, itemsLoaded]); 

  // 根據視窗大小計算縮放比例，讓欄框跟書本背景一起縮放
  useEffect(() => {
    const handleResize = () => {
      const windowW = window.innerWidth;
      const windowH = window.innerHeight;

      const scaleX = windowW / BASE_WIDTH;
      const scaleY = windowH / BASE_HEIGHT;
      let s = Math.min(scaleX, scaleY);

      if (s < MIN_SCALE_THRESHOLD) {
        s = MIN_SCALE_THRESHOLD;
      }

      setScale(s);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  const handleImageChange = (index: number, file: File) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result as string | null;
      if (!result) return;

      setItems((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          image: file,
          // 儲存為 base64 字串，讓重新整理或回到此頁時仍可顯示
          preview: result,
        };
        return next;
      });
    };

    reader.readAsDataURL(file);
  };

  const handleNameChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index].name = value;
    setItems(newItems);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      items.forEach((item, i) => {
        formData.append(`item${i}_name`, item.name);
        // 確保如果沒有圖片，也傳送空值
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

  const handleClearAll = () => {
    if (!window.confirm("確定要清除目前頁面上的所有圖片與名稱嗎？此操作只影響這台電腦的資料。")) {
      return;
    }
    const empty = createInitialItems();
    setItems(empty);
    try {
      localStorage.removeItem(SHOP_ITEMS_STORAGE_KEY);
    } catch (e) {
      console.warn("清除 shop localStorage 失敗", e);
    }
  };

  return (
    <main className={styles.wrapper}>
      {/* 書本背景：跟欄框一起依 BASE_WIDTH/BASE_HEIGHT 縮放 */}
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

        {/* 欄框區：置中壓在書本上，會跟著一起縮放 */}
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
                {item.preview ? (
                  <img src={item.preview} alt="預覽" className={styles.preview} />
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

        {/* 下方按鈕列：固定在書本下緣附近，隨場景縮放 */}
        <div
          className={styles.bottomBar}
          style={{
            position: "absolute",
            left: "50%",
            bottom: "40px",
            transform: "translateX(-50%)",
          }}
        >
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "上傳中..." : "送出"}
          </button>
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