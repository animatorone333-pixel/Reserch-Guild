"use client";
import React, { useEffect, useState } from "react";

// 1. 基礎尺寸常數
const BASE_WIDTH = 1365;  
const BASE_HEIGHT = 768;  
// 防止內容在小視窗下縮得過小：最低縮放比例
const MIN_SCALE_THRESHOLD = 0.9;

// 2. Z-Index 常數 (優化可讀性)
const Z_BACKGROUND_FIXED = 0;
const Z_SCENE_CONTAINER = 1;
const Z_BOOK_UI = 1;         // game_14_01 現在是場景內的最底層
const Z_IMAGE_CONTENT = 5;
const Z_DATE_BUTTON = 4;
const Z_HOME_BUTTON = 3;

// 3. 樣式提取：絕對置中樣式
const absoluteCenterStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
};

// 4. 樣式提取：按鈕基礎樣式 (優化)
const baseButtonStyle: React.CSSProperties = {
  position: "absolute",
  cursor: "pointer",
  fontWeight: "bold",
  whiteSpace: "nowrap",
  boxSizing: "border-box", 
};

// 5. 樣式提取：日期按鈕特定樣式
const dateButtonStyle: React.CSSProperties = {
    ...baseButtonStyle,
    zIndex: Z_DATE_BUTTON,
    left: "22%", 
    bottom: "13%", 
    background: "#6b492a",
    color: "white",
    padding: "6px 14px",
    borderRadius: 6,
    border: "2px solid #ecd3a9",
    fontSize: 12,
    boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
    textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
};

// 6. 樣式提取：回首頁按鈕特定樣式
const homeButtonStyle: React.CSSProperties = {
    ...baseButtonStyle,
    zIndex: Z_HOME_BUTTON,
    left: "50%", 
    bottom: "60px", 
    transform: "translateX(-50%)", 
    background: "rgba(255,255,255,0.1)", 
    color: "white", 
    padding: "8px 18px", 
    borderRadius: 6, 
    border: "1px solid rgba(255,255,255,0.4)", 
    fontWeight: "bold", 
    fontSize: 14, 
    backdropFilter: "blur(3px)", 
};


export default function GalleryPage() {
  const [scale, setScale] = useState(1);

  // 根據視窗大小計算場景縮放比例，讓整個畫面跟著背景「等比例縮放」
  useEffect(() => {
    const handleResize = () => {
      const windowW = window.innerWidth;
      const windowH = window.innerHeight;

      const scaleX = windowW / BASE_WIDTH;
      const scaleY = windowH / BASE_HEIGHT;
      let s = Math.min(scaleX, scaleY); // 確保內容不超出畫面

      if (s < MIN_SCALE_THRESHOLD) {
        s = MIN_SCALE_THRESHOLD;
      }

      setScale(s);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#000", 
        display: "flex",
        justifyContent: "center", 
        alignItems: "center",     
      }}
    >
      {/* 1. 🥇 外部固定背景 (game_14.png)：覆蓋全螢幕，徹底解決黑邊問題 */}
      <img
        src="/game_14.png"
        alt="全螢幕背景 (防止黑邊)"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "100vw",
          height: "100vh",
          objectFit: "cover", // 覆蓋整個視窗
          zIndex: Z_BACKGROUND_FIXED, 
        }}
      />
      
      {/* 2. 縮放場景容器：使用 scale + translate 實現精確置中 */}
      <div
        style={{
          position: "relative",
          // 直接使用計算後的實際寬高，讓 game_14_01 跟著視窗等比例縮放
          width: `${BASE_WIDTH * scale}px`,
          height: `${BASE_HEIGHT * scale}px`,
          zIndex: Z_SCENE_CONTAINER, // 蓋在固定背景之上
        }}
      >
        {/* 上層：書本 UI game_14_01 (現在是場景的基礎元素/容器) */}
        <img
          src="/game_14_01.png"
          alt="書本介面"
          style={{
            ...absoluteCenterStyle,
            width: "100%",
            height: "100%",
            objectFit: "contain", 
            zIndex: Z_BOOK_UI, 
            pointerEvents: "none",
          }}
        />

        {/* 圖片 Image_01 (置中後稍微往下位移，跟著 game_14_01 縮放) */}
        <img
          src="/Image_01.jpg" 
          alt="活動劇照"
          style={{
            ...absoluteCenterStyle,
            // 介於原本 -50% 和剛才 -40% 之間，略微往下
            transform: "translate(-50%, -45%)",
            width: "42%", // 百分比尺寸
            height: "42%", // 百分比尺寸
            objectFit: "cover",
            zIndex: Z_IMAGE_CONTENT, 
            pointerEvents: "none",
            borderRadius: "4px",
          }}
        />
        
        {/* 日期按鈕 "2025.9.8" (樣式已提取) */}
        <button
          style={dateButtonStyle}
        >
          2025.9.8
        </button>
        

        {/* 🔹回首頁按鈕 (樣式已提取) */}
        <button
          onClick={() => (window.location.href = "/")}
          style={homeButtonStyle}
        >
          回首頁
        </button>
      </div>
    </main>
  );
}