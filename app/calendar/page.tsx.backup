"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

const CALENDAR_NOTES_KEY = "calendar_notes_v1";

export default function CalendarPage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // 縮放控制
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // 基準尺寸
  const baseWidth = 1365;
  const baseHeight = 768;

  useEffect(() => {
    const loggedIn = localStorage.getItem("mygame_loggedIn") === "true";
    const user = localStorage.getItem("mygame_user");
    if (loggedIn && user) {
      const parsed = JSON.parse(user);

      // 🔹 加上正規化，支援 formData.avatar
      let avatar =
        parsed?.avatar ||
        parsed?.image ||
        parsed?.avatarUrl ||
        parsed?.photoURL ||
        (parsed?.formData && parsed.formData.avatar) ||
        "";

      if (avatar) {
        if (/^https?:\/\//i.test(avatar) || avatar.startsWith("data:image")) {
          // 完整網址或 base64 → 直接用
        } else {
          // 相對路徑 → 補上 "/"
          avatar = avatar.startsWith("/") ? avatar : "/" + avatar;
        }
      } else {
        avatar = "/game_04.png"; // 預設頭像
      }

      setIsLoggedIn(true);
      setUsername(parsed.nickname || parsed.name || "訪客");
      setAvatar(avatar);
    } else {
      setIsLoggedIn(false);
      setUsername("訪客");
      setAvatar("/game_04.png");
    }

    // 你的縮放監聽可以放在這裡
    const updateScale = () => {
      const scaleX = window.innerWidth / baseWidth;
      const scaleY = window.innerHeight / baseHeight;
      const scale = Math.min(scaleX, scaleY);
      setScale(scale);
      setOffsetX((window.innerWidth - baseWidth * scale) / 2);
      setOffsetY((window.innerHeight - baseHeight * scale) / 2);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const monthNames = [
    "一月","二月","三月","四月","五月","六月",
    "七月","八月","九月","十月","十一月","十二月"
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  };

  const getDaysInMonth = (y: number, m: number) =>
    new Date(y, m + 1, 0).getDate();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  // 行事曆備註：以日期 key (YYYY-MM-DD) 存文字
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notesLoaded, setNotesLoaded] = useState(false);

  // 載入已儲存的備註
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(CALENDAR_NOTES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setNotes(parsed);
        }
      }
    } catch (e) {
      console.warn("載入行事曆備註失敗", e);
    } finally {
      // 標記已完成初始化，之後才允許寫回 localStorage
      setNotesLoaded(true);
    }
  }, []);

  // 備註變更時即時儲存（避免初次載入時就把舊資料覆蓋成空物件）
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!notesLoaded) return;
    try {
      localStorage.setItem(CALENDAR_NOTES_KEY, JSON.stringify(notes));
    } catch (e) {
      console.warn("儲存行事曆備註失敗", e);
    }
  }, [notes, notesLoaded]);

  // 假設登入資訊
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 預設未登入
  const [username, setUsername] = useState("小明"); // 測試用，之後換成真正使用者名字
  const [avatar, setAvatar] = useState("/game_04.png"); // 測試用，之後換成真正頭像

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        backgroundImage: "url('/game_12.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* === 舞台 A：日曆容器 === */}
      <div
        style={{
          position: "absolute",
          top: offsetY,
          left: offsetX,
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <img
          src="/game_13.png"
          alt="calendar-frame"
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* 日曆內容 */}
        <div
          style={{
            position: "absolute",
            top: "120px",
            left: "140px",
            right: "140px",
            bottom: "120px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            color: "#3b0d0dff",
          }}
        >
          <table
            style={{
              width: "40%",
              height: "35%",
              margin: "auto",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              // 反向補償縮放比例，讓實際顯示字體大小維持接近 12px
              fontSize: `${12 / (scale || 1)}px`,
            }}
          >
            <thead>
              {/* 🔹 月份標題列 */}
              <tr>
                <th
                  colSpan={7}
                  style={{
                    textAlign: "center",
                    fontSize: "18px",
                    fontWeight: "bold",
                  }}
                >
                  <button onClick={handlePrevMonth}>⬅</button>
                  <span style={{ margin: "0 12px" }}>
                    {monthNames[currentMonth]} {currentYear}
                  </span>
                  <button onClick={handleNextMonth}>➡</button>
                </th>
              </tr>
              {/* 星期列 */}
              <tr>
                {["日","一","二","三","四","五","六"].map((d) => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil((daysInMonth + firstDay) / 7) }).map((_, weekIndex) => (
                <tr key={weekIndex}>
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const day = weekIndex * 7 + dayIndex - firstDay + 1;
                    const dateKey =
                      day > 0 && day <= daysInMonth
                        ? `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        : "";
                    return (
                      <td
                        key={dayIndex}
                        style={{
                          border: "1px solid rgba(0,0,0,0.2)",
                          verticalAlign: "top",
                          padding: "2px",
                        }}
                      >
                        {day > 0 && day <= daysInMonth ? (
                          <>
                            <div style={{ fontWeight: "bold" }}>{day}</div>
                            <textarea
                              style={{
                                width: "100%",
                                height: "20px",
                                resize: "none",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                color: "red",
                                fontWeight: "bold",
                              }}
                              className="calendar-note-textarea"
                              value={dateKey ? notes[dateKey] || "" : ""}
                              onChange={(e) => {
                                if (!dateKey) return;
                                const value = e.target.value;
                                setNotes((prev) => ({
                                  ...prev,
                                  [dateKey]: value,
                                }));
                              }}
                              placeholder="行程..."
                            />
                          </>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* === 舞台 B：頭像區（登入判斷） === */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          style={{
            width: "200px",
            height: "80px",
            backgroundImage: "url('/game_03.png')",
            backgroundSize: "cover",
            borderRadius: "8px",
            padding: "0 10px 0 46px",
            display: "flex",
            alignItems: "center",
            color: "white",
            position: "relative",
          }}
        >
          {isLoggedIn ? (
            <>
              <img
                src={avatar || "/game_04.png"} 
                alt="頭像"  
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "18px",
                  width: "41px",
                  height: "41px",
                  borderRadius: "50%",
                }}
              />
              <div style={{ marginLeft: "60px", fontWeight: "bold" }}>
                {username}
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "18px",
                  width: "41px",
                  height: "41px",
                  borderRadius: "50%",
                  backgroundColor: "#333",
                  color: "white",
                  fontSize: "20px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                訪
              </div>
              <div style={{ marginLeft: "60px", fontWeight: "bold" }}>訪客</div>
            </>
          )}
        </div>
      </div>

        {/* === 舞台 C：回首頁按鈕 === */}
        <div
        style={{
            position: "absolute",               // 固定在舞台內相對位置
            bottom: "20px",                     // 距離舞台底部 20px
            left: "50%",
            transform: `translateX(-50%) scale(${scale})`, // 同步縮放
            transformOrigin: "bottom center",   // 縮放基準點在底部中間
        }}
        >
        <Link href="/">
            <button
            style={{
                padding: "8px 12px",
                fontSize: "14px",
                backgroundColor: "#89af4cff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
            }}
            >
            回首頁
            </button>
        </Link>
        </div>

    </main>
  );
}
