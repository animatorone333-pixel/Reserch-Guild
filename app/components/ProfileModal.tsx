"use client";
import React, { useEffect, useRef, useState } from "react";

export default function ProfileModal({
  user,
  onClose,
}: {
  user?: { nickname?: string; avatar?: string; profession?: string; loginDays?: number };
  onClose: () => void;
}) {
  const designWidth = 720; // 設計稿寬度（game_05 的基準寬度）
  const [designHeight, setDesignHeight] = useState(480); // 會在下方用 image natural ratio 更新
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // 讀取圖片 natural ratio，取得 designHeight
  useEffect(() => {
    const img = new Image();
    img.src = "/game_05.png";
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setDesignHeight(Math.round((designWidth * img.naturalHeight) / img.naturalWidth));
      }
    };
  }, []);

  useEffect(() => {
    const calc = () => {
      if (!wrapperRef.current) return;
      // 根據視窗寬高同時限制 scale，避免只以寬度縮放造成超出高度
      const maxW = window.innerWidth * 0.92;
      const maxH = window.innerHeight * 0.92;
      const s = Math.min(1, maxW / designWidth, maxH / designHeight);
      setScale(s);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60000,
        padding: 20,
      }}
    >
      {/* unscaled centering container */}
      <div
        onClick={(e) => e.stopPropagation()}
        ref={wrapperRef}
        style={{
          transformOrigin: "center center",
          // 用 flex 置中縮放後的 inner 容器
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* inner 以 designWidth 為基準，整個 inner 會被 scale，內部絕對定位的文字會跟著縮放 */}
        <div
          style={{
            width: designWidth,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            background: "#111",
            color: "white",
            position: "relative",
            transform: `scale(${scale})`,
            transformOrigin: "center center", // 以中心縮放，避免位移
            margin: "0 auto",                 // 確保置中
          }}
        >
          {/* 背景圖 */}
          <img
            src="/game_05.png"
            alt="人物資訊"
            style={{ width: "100%", display: "block", objectFit: "cover" }}
          />

          {/* 以下文字/頭像覆蓋區均用設計稿座標（在原本檔案的相同位置） */}
          {/* 頭像（紅色框區域） */}
          <div
            style={{
              position: "absolute",
              top: 88, // px（基於 designWidth）
              left: 290,
              width: 50,
              height: 50,
              borderRadius: 8,
              overflow: "hidden",
              background: "#333",
            }}
          >
            <img
              src="/game_06.png"
              alt="avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          {/* 職業 + 登入天數（同一行，職業後面顯示登入天數，中間有間隔符號） */}
          <div
            style={{
              position: "absolute",
              top: 105, // px
              left: 350,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            <span>{user?.profession || "職業未設定"}</span>
            {typeof user?.loginDays === "number" && (
              <span style={{ color: "rgba(255,255,255,0.95)", fontWeight: 600 }}>
                {"\u00A0・\u00A0"}登入 {user!.loginDays} 天
              </span>
            )}
          </div>

          {/* 暱稱（咖啡色框區域） */}
          <div
            style={{
              position: "absolute",
              bottom: 88,
              left: 55,
              width: 200,
              textAlign: "center",
              fontSize: 18,
              fontWeight: "bold",
              color: "white",
            }}
          >
            {user?.nickname || "訪客"}
          </div>

          {/* 關閉按鈕（設在 inner 的右下，不會被 scale 影響互動） */}
          <div style={{ position: "absolute", right: 20, bottom: 20 }}>
            <button
              onClick={onClose}
              style={{
                background: "rgba(0,0,0,0.6)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

