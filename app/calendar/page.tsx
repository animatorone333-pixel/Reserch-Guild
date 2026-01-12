"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase 設定
const ENV_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ENV_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const initialHasSupabase = ENV_SUPABASE_URL !== "" && ENV_SUPABASE_ANON_KEY !== "";
const initialSupabase: SupabaseClient | null = initialHasSupabase
  ? createClient(ENV_SUPABASE_URL, ENV_SUPABASE_ANON_KEY)
  : null;

// Fallback localStorage key
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

  // 行事曆備註：以日期 key (YYYY-MM-DD) 存文字
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [useSupabase, setUseSupabase] = useState(false);

  const [hasSupabase, setHasSupabase] = useState(initialHasSupabase);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(initialSupabase);
  const [initializedData, setInitializedData] = useState(false);

  // 假設登入資訊
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("訪客");
  const [avatar, setAvatar] = useState("/game_04.png");

  // === 從 Supabase 載入備註 ===
  const loadFromSupabase = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('calendar_notes')
        .select('*');

      if (error) throw error;

      if (data) {
        const notesMap: Record<string, string> = {};
        data.forEach(item => {
          notesMap[item.date_key] = item.note_text || '';
        });
        setNotes(notesMap);
        console.log("✅ 從 Supabase 載入行事曆備註成功");
      }
    } catch (error) {
      console.error("❌ 從 Supabase 載入失敗:", error);
      // Fallback 到 localStorage
      loadFromLocalStorage();
    }
  };

  // === Fallback: 從 localStorage 載入 ===
  const loadFromLocalStorage = () => {
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
    }
  };

  // === 更新備註到 Supabase ===
  const updateNoteInSupabase = async (dateKey: string, noteText: string) => {
    if (!supabase) return;

    try {
      // 使用 upsert 來新增或更新
      const { error } = await supabase
        .from('calendar_notes')
        .upsert({
          date_key: dateKey,
          note_text: noteText,
          user_id: 'guest' // 可根據實際登入使用者修改
        }, {
          onConflict: 'date_key'
        });

      if (error) throw error;
    } catch (error) {
      console.error("❌ 更新 Supabase 備註失敗:", error);
    }
  };

  // === 初始化 ===
  useEffect(() => {
    // 載入登入資訊
    const loggedIn = localStorage.getItem("mygame_loggedIn") === "true";
    const user = localStorage.getItem("mygame_user");
    if (loggedIn && user) {
      const parsed = JSON.parse(user);
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
        avatar = "/game_04.png";
      }

      setIsLoggedIn(true);
      setUsername(parsed.nickname || parsed.name || "訪客");
      setAvatar(avatar);
    } else {
      setIsLoggedIn(false);
      setUsername("訪客");
      setAvatar("/game_04.png");
    }

    // 縮放監聽
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

  // 載入備註資料（等 Supabase config 就緒後再決策一次）
  useEffect(() => {
    const initializeData = async () => {
      if (initializedData) return;
      if (hasSupabase && !supabase) return;

      if (hasSupabase && supabase) {
        setUseSupabase(true);
        await loadFromSupabase();
      } else {
        setUseSupabase(false);
        loadFromLocalStorage();
      }
      setNotesLoaded(true);
      setInitializedData(true);
    };
    initializeData();
  }, [hasSupabase, supabase, initializedData]);

  // === Supabase Realtime 訂閱 ===
  useEffect(() => {
    if (!useSupabase || !supabase) return;

    const channel = supabase
      .channel('public:calendar_notes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_notes' },
        (payload) => {
          console.log('📡 Calendar notes 變更:', payload);
          
          // 即時更新本地狀態
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRecord = payload.new as any;
            setNotes(prev => ({
              ...prev,
              [newRecord.date_key]: newRecord.note_text || ''
            }));
          } else if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as any;
            setNotes(prev => {
              const newNotes = { ...prev };
              delete newNotes[oldRecord.date_key];
              return newNotes;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [useSupabase]);

  // === localStorage 持久化（Fallback 模式） ===
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!notesLoaded) return;
    if (useSupabase) return; // Supabase 模式不需要 localStorage 持久化

    try {
      localStorage.setItem(CALENDAR_NOTES_KEY, JSON.stringify(notes));
    } catch (e) {
      console.warn("儲存行事曆備註失敗", e);
    }
  }, [notes, notesLoaded, useSupabase]);

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

  // === 處理備註變更 ===
  const handleNoteChange = async (dateKey: string, value: string) => {
    // 立即更新本地狀態（樂觀更新）
    setNotes(prev => ({
      ...prev,
      [dateKey]: value,
    }));

    // 如果使用 Supabase，同步到資料庫
    if (useSupabase) {
      await updateNoteInSupabase(dateKey, value);
    }
  };

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
        zIndex: 1000,
        display: 'none'
      }}>
        {useSupabase ? '🟢 Supabase' : '🟡 LocalStorage'}
      </div>

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
              fontSize: `${12 / (scale || 1)}px`,
            }}
          >
            <thead>
              {/* 月份標題列 */}
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
                                handleNoteChange(dateKey, e.target.value);
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
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "bottom center",
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
