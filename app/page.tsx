"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import ChatBox from "./components/ChatBox"; 
import ProfileModal from "./components/ProfileModal";
import { createClient, SupabaseClient } from "@supabase/supabase-js"; 

// Supabase 設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
const supabase: SupabaseClient | null = hasSupabase 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// 🔑 確保與報名頁面使用同一個 Key
const FORM_INPUT_KEY = "form_input_v1"; 
const USER_HISTORY_KEY = "mygame_user_history_v1";

const loadFormInput = (): { name: string; department: string; nickname: string; avatar: string; } => {
    if (typeof window === 'undefined') return { name: "", department: "", nickname: "", avatar: "/game_04.png" };
    const storedJson = localStorage.getItem(FORM_INPUT_KEY);
    if (storedJson) {
        try {
            return JSON.parse(storedJson);
        } catch (e) {
            console.error("解析暫存失敗", e);
        }
    }
    return { name: "", department: "", nickname: "", avatar: "/game_04.png" };
};

// --- 這裡結束複製 ---

  interface UserHistoryRecord {
    department: string;
    name: string;
    nickname: string;
    avatar: string;
    profession?: string;
    loginDays: number;
    lastLoginDate: string;
  }

  const getTodayString = () => {
    return new Date().toISOString().slice(0, 10);
  };

  const getUserKey = (name: string, nickname: string) => {
    return `${name.trim()}__${nickname.trim()}`;
  };

  const loadUserHistory = (): Record<string, UserHistoryRecord> => {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(USER_HISTORY_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, UserHistoryRecord>;
    } catch (e) {
      console.error("解析使用者歷程失敗", e);
      return {};
    }
  };

  const saveUserHistory = (history: Record<string, UserHistoryRecord>) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(USER_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error("儲存使用者歷程失敗", e);
    }
  };

/** 將各種來源的頭像網址正規化（支援 data/http/https/絕對路徑） */
function normalizeAvatarUrl(u?: string): string {
  if (!u) return "/game_04.png";
  const url = u.trim();
  if (/^data:image\//i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return url;
  return "/" + url.replace(/^\.?\//, "");
}

// 職業列表
const professions = [
  "薪水小偷", "動物管理員", "總統", "垃圾車", "神射手", "慣老闆","美女", 
  "愛情顧問", "瞌睡蟲", "香菇", "貓咪", "狗狗", "社畜","帥哥", "廢宅",
  "主管", "法師", "獵人", "戰士", "盜賊", "牧師", "聖騎士", "德魯伊", "薩滿", "自訂"
];

// 登入後使用者資料結構
interface UserData {
  department: string;
  name: string;
  nickname: string;
  avatar: string;
  profession?: string;
  loginDays?: number;
   lastLoginDate?: string;
}

export default function Home() {
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  
  // ✅ 只保留一份初始化邏輯：初始化時先載入暫存
  const initialFormInput = useMemo(() => loadFormInput(), []);

  const [formData, setFormData] = useState<UserData>({
    department: initialFormInput.department || "",
    name: initialFormInput.name || "",
    nickname: initialFormInput.nickname || "",
    avatar: initialFormInput.avatar || "/game_04.png",
  });
  
  // 左上角狀態面板使用的狀態
  const [jobIndex, setJobIndex] = useState(0); 
  const [customProfession, setCustomProfession] = useState("");
  const [loginDays, setLoginDays] = useState(1); 
  
  // ProfileModal 相關狀態 (由 page.tsx 統一管理)
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState<
    Omit<UserData, 'department' | 'name'> & { profession?: string, loginDays?: number }
  >();

  // 不完整資訊提示
  const [showIncompleteAlert, setShowIncompleteAlert] = useState(false);

  // 首頁最新公告：可自由編輯 + localStorage 持久化
  const [announcements, setAnnouncements] = useState<string>("");
  const [useSupabase, setUseSupabase] = useState(false);
  const [announcementsLoaded, setAnnouncementsLoaded] = useState(false);
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [draftAnnouncement, setDraftAnnouncement] = useState<string>("");
  const [announcementId, setAnnouncementId] = useState<number | null>(null);
  
  // 全域登入使用者狀態
  const [currentUser, setCurrentUser] = useState<{
    nickname: string;
    avatar: string;
    loggedIn: boolean;
  }>({
    nickname: "",
    avatar: "",
    loggedIn: false,
  });

  // 頭像上傳 input 的 ref
  // 修正：將 fileInputRef 的初始化值設為 null，而不是它自己
  const fileInputRef = useRef<HTMLInputElement | null>(null); 

  // --- 這裡開始複製 ---
// 當欄位變動時，即時存入 localStorage (確保去報名頁面時資料在)
  useEffect(() => {
    if (!loggedIn && typeof window !== 'undefined') {
        localStorage.setItem(FORM_INPUT_KEY, JSON.stringify({
            department: formData.department,
            name: formData.name,
            nickname: formData.nickname,
            avatar: formData.avatar,
        }));
    }
  }, [loggedIn, formData.department, formData.name, formData.nickname, formData.avatar]);

  // --- 這裡結束複製 ---

  // 取得目前選取的職業名稱（可自訂職稱優先）
  const currentProfession = useMemo(() => {
    const trimmed = customProfession.trim();
    return trimmed || professions[jobIndex];
  }, [jobIndex, customProfession]);

  // *** 修正點：統一處理開啟人物視窗的邏輯 (給 ChatBox 和左上角頭像使用) ***
  const handleOpenProfile = (user: { nickname?: string; avatar?: string; profession?: string; loginDays?: number }) => {
    // 檢查是否是登入的使用者（左上角頭像點擊），如果是，用完整資料
    if (loggedIn && user.nickname === (formData.nickname || formData.name)) {
      setProfileUser({
        nickname: formData.nickname || formData.name,
        avatar: currentUser.avatar || formData.avatar,
        profession: currentProfession,
        loginDays,
      });
    } else {
      // 否則，用 ChatBox 傳入的簡單資料
      setProfileUser(user as any); 
    }
    setShowProfile(true);
  };
  // ***************************************

  // 1. 舞台縮放與置中邏輯 (修正：確保內容完整顯示，使用 Math.min)
  useEffect(() => {
    const updateScale = () => {
      const baseWidth = 1280;
      const baseHeight = 720;
      const scaleX = window.innerWidth / baseWidth;
      const scaleY = window.innerHeight / baseHeight;
      // 修正：使用 Math.min 確保整個舞台不會超出螢幕邊界
      const s = Math.min(scaleX, scaleY); 
      setScale(s);
      // 置中計算
      setOffsetX((window.innerWidth - baseWidth * s) / 2);
      setOffsetY((window.innerHeight - baseHeight * s) / 2);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // === 從 Supabase 載入公告 ===
  const loadAnnouncementFromSupabase = async () => {
    if (!supabase) return;

    try {
      // 查詢第一筆公告（按 id 排序）
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('id', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        console.error("❌ Supabase 查詢錯誤:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // 如果是找不到資料，嘗試插入預設公告
        if (error.code === 'PGRST116') {
          console.log("📝 資料表為空，嘗試插入預設公告...");
          const defaultContent = "💌最新公告\n" +
            "🔸下次桌遊將在10/13舉行!\n" +
            "🔸歡迎推薦遊戲品項，請至桌遊投票區開盲盒!\n" +
            "🔸本月主題日_夜市人生，將舉行射擊遊戲!歡迎來練習!";
          
          const { data: insertData, error: insertError } = await supabase
            .from('announcements')
            .insert({ content: defaultContent })
            .select()
            .single();
          
          if (!insertError && insertData) {
            setAnnouncements(defaultContent);
            setAnnouncementId(insertData.id);
            console.log("✅ 預設公告已插入並載入，id:", insertData.id);
            return;
          } else {
            console.error("❌ 插入預設公告失敗:", insertError);
          }
        }
        
        throw error;
      }

      if (data) {
        setAnnouncements(data.content || '');
        setAnnouncementId(data.id);
        console.log("✅ 從 Supabase 載入公告成功，id:", data.id);
      }
    } catch (error: any) {
      console.error("❌ 從 Supabase 載入公告失敗:", {
        error,
        message: error?.message || "未知錯誤",
        hint: "請檢查: 1) RLS 政策是否已設定 2) API key 是否正確 3) 資料表是否存在"
      });
      // Fallback 到 localStorage
      loadAnnouncementFromLocalStorage();
    }
  };

  // === Fallback: 從 localStorage 載入 ===
  const loadAnnouncementFromLocalStorage = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("home_announcements_v1");
      if (raw) {
        setAnnouncements(raw);
      } else {
        // 預設公告內容
        setAnnouncements(
          "💌最新公告\n" +
            "🔸下次桌遊將在10/13舉行!\n" +
            "🔸歡迎推薦遊戲品項，請至桌遊投票區開盲盒!\n" +
            "🔸本月主題日_夜市人生，將舉行射擊遊戲!歡迎來練習!"
        );
      }
    } catch (e) {
      console.warn("載入首頁公告失敗", e);
    }
  };

  // === 初始化：載入公告 ===
  useEffect(() => {
    const initialize = async () => {
      if (hasSupabase && supabase) {
        setUseSupabase(true);
        await loadAnnouncementFromSupabase();
      } else {
        setUseSupabase(false);
        loadAnnouncementFromLocalStorage();
      }
      setAnnouncementsLoaded(true);
    };

    initialize();
  }, []);

  // === Supabase Realtime 訂閱 ===
  useEffect(() => {
    if (!useSupabase || !supabase || !announcementId) return;

    const channel = supabase
      .channel('public:announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements', filter: `id=eq.${announcementId}` },
        (payload) => {
          console.log('📡 Announcements 變更:', payload);
          if (payload.eventType === 'UPDATE' && payload.new) {
            const newData = payload.new as any;
            const newContent = newData.content || '';
            setAnnouncements(newContent);
            // 如果不是在編輯模式，也更新草稿
            if (!isEditingAnnouncement) {
              setDraftAnnouncement(newContent);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [useSupabase, isEditingAnnouncement, announcementId]);

  // === localStorage 持久化（Fallback 模式） ===
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!announcementsLoaded) return;
    if (useSupabase) return;

    try {
      localStorage.setItem("home_announcements_v1", announcements);
    } catch (e) {
      console.warn("儲存首頁公告失敗", e);
    }
  }, [announcements, announcementsLoaded, useSupabase]);

  // === 公告編輯功能 ===
  const handleStartEditAnnouncement = () => {
    setDraftAnnouncement(announcements);
    setIsEditingAnnouncement(true);
  };

  const handleCancelEditAnnouncement = () => {
    setDraftAnnouncement(announcements);
    setIsEditingAnnouncement(false);
  };

  const handleSaveAnnouncement = async () => {
    const value = draftAnnouncement;
    
    // 如果使用 Supabase，同步到資料庫
    if (useSupabase && supabase && announcementId) {
      try {
        console.log("🔄 開始更新公告到 Supabase，id:", announcementId);
        
        const { data, error } = await supabase
          .from('announcements')
          .update({ content: value })
          .eq('id', announcementId)
          .select();
        
        if (error) {
          console.error("❌ 更新 Supabase 公告失敗:", error);
          alert(`儲存失敗（已暫存本機）：${error.message}`);
          // 降級到 localStorage
          if (typeof window !== "undefined") {
            localStorage.setItem("home_announcements_v1", value);
          }
        } else {
          console.log("✅ 公告已成功同步到 Supabase:", data);
          // 更新本地狀態
          setAnnouncements(value);
        }
      } catch (err: any) {
        console.error("❌ 更新失敗:", err);
        alert(`儲存失敗（已暫存本機）：${err?.message || '未知錯誤'}`);
        if (typeof window !== "undefined") {
          localStorage.setItem("home_announcements_v1", value);
        }
      }
    } else {
      // Fallback: 儲存到 localStorage
      console.log("💾 使用 localStorage 儲存公告");
      setAnnouncements(value);
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("home_announcements_v1", value);
        }
      } catch (err) {
        console.warn("儲存首頁公告失敗", err);
        alert('儲存失敗，請稍後再試');
      }
    }
    
    setIsEditingAnnouncement(false);
  };

  // 職業選擇器 (保持不變)
  const handlePrevJob = () => {
    setCustomProfession("");
    setJobIndex((prev) => (prev - 1 + professions.length) % professions.length);
  };
  const handleNextJob = () => {
    setCustomProfession("");
    setJobIndex((prev) => (prev + 1) % professions.length);
  };

  // 上傳頭像 (保持不變)
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        avatar: (reader.result as string) || "",
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };

  // 登入處理 (保持不變)
  const handleLogin = async () => {
    if (!formData.department?.trim() || !formData.name?.trim()) {
      setShowIncompleteAlert(true);
      return;
    }
    
    const payload = {
      ...formData,
      profession: currentProfession, 
    };

    try {
      // 模擬成功回應
      const data = { success: true }; 

      if (data.success) {
        setLoggedIn(true);
        setShowLogin(false);

        // 以「姓名 + 暱稱」作為帳號鍵，累計登入天數
        const history = loadUserHistory();
        const userKey = getUserKey(formData.name || "", formData.nickname || "");
        const today = getTodayString();

        const existing = userKey ? history[userKey] : undefined;
        let userLoginDays = 1;
        let lastLoginDate = today;

        if (existing) {
          if (existing.lastLoginDate === today) {
            userLoginDays = existing.loginDays; // 今天已經登入過，不再加一天
          } else {
            userLoginDays = existing.loginDays + 1;
            lastLoginDate = today;
          }
        }

        const userProfession = payload.profession || professions[0]; 
        const normalizedAvatar = normalizeAvatarUrl(
          formData.avatar || "/game_04.png"
        );
        
        setLoginDays(userLoginDays);
        setJobIndex(professions.findIndex(p => p === userProfession) !== -1 
          ? professions.findIndex(p => p === userProfession) 
          : 0);

        const userToStore: UserHistoryRecord = { 
            name: formData.name,
            nickname: formData.nickname,
            department: formData.department,
            profession: userProfession,
            loginDays: userLoginDays,
            lastLoginDate,
            avatar: normalizedAvatar,
        };

        if (userKey) {
          history[userKey] = userToStore;
          saveUserHistory(history);
        }
        
        localStorage.setItem("mygame_loggedIn", "true");
        localStorage.setItem("mygame_user", JSON.stringify(userToStore));
        localStorage.removeItem(FORM_INPUT_KEY);
        
        setCurrentUser({
          nickname: formData.nickname || formData.name || "訪客",
          avatar: normalizedAvatar,
          loggedIn: true,
        });
      }
    } catch (err) {
      console.error("登入失敗", err);
    }
  };

  // 頁面初始化時讀取本地儲存 (保持不變)
  useEffect(() => {
    const isLoggedIn = localStorage.getItem("mygame_loggedIn") === "true";
    const user = localStorage.getItem("mygame_user");

    // 快速預覽：若網址帶 ?guest=1，直接以訪客身分顯示（不寫入 localStorage）
    const params = new URLSearchParams(window.location.search);
    const forceGuest = params.get("guest") === "1";

    if (forceGuest) {
      setLoggedIn(true);
      const guest = {
        department: "訪客",
        name: "訪客",
        nickname: "訪客",
        avatar: "/game_04.png",
      };
      setFormData(guest);
      setCurrentUser({ nickname: guest.nickname, avatar: guest.avatar, loggedIn: true });
    } else if (isLoggedIn && user) {
      try {
        const parsed = JSON.parse(user) as UserData & {profession?: string, loginDays?: number, lastLoginDate?: string};

        // 每天首次開啟頁面時，自動幫同一位使用者累計登入天數
        const today = getTodayString();
        let effectiveLoginDays = parsed.loginDays || 1;

        if (parsed.lastLoginDate && parsed.lastLoginDate !== today) {
          effectiveLoginDays = effectiveLoginDays + 1;
          parsed.loginDays = effectiveLoginDays;
          parsed.lastLoginDate = today;

          // 同步更新目前使用者與歷程紀錄
          localStorage.setItem("mygame_user", JSON.stringify(parsed));

          const history = loadUserHistory();
          const userKey = getUserKey(parsed.name || "", parsed.nickname || "");
          if (userKey) {
            const existing = history[userKey];
            history[userKey] = {
              name: parsed.name || existing?.name || "",
              nickname: parsed.nickname || existing?.nickname || "",
              department: parsed.department || existing?.department || "",
              avatar: parsed.avatar || existing?.avatar || "/game_04.png",
              profession: parsed.profession || existing?.profession,
              loginDays: effectiveLoginDays,
              lastLoginDate: today,
            };
            saveUserHistory(history);
          }
        }
        
        const avatarRaw: string =
          (parsed as any)?.avatar ||
          (parsed as any)?.image ||
          (parsed as any)?.avatarUrl ||
          (parsed as any)?.photoURL ||
          "";
          
        const avatar = normalizeAvatarUrl(avatarRaw);

        setFormData({
            department: parsed.department || "",
            name: parsed.name || "",
            nickname: parsed.nickname || "",
            avatar: avatar,
        });
        
        if (parsed.profession) {
            const index = professions.findIndex(p => p === parsed.profession);
            if (index !== -1) {
              setJobIndex(index);
            } else {
              setCustomProfession(parsed.profession);
            }
        }
        setLoginDays(effectiveLoginDays);
        
        setLoggedIn(true);
        setCurrentUser({
          nickname: parsed.nickname || parsed.name || "訪客",
          avatar,
          loggedIn: true,
        });

      } catch(e) {
        console.warn("解析本地使用者資料失敗", e);
        localStorage.removeItem("mygame_loggedIn");
        localStorage.removeItem("mygame_user");
      }
    }
  }, []);

  // 登出處理函式 (保持不變)
  const handleLogout = () => {
    localStorage.removeItem("mygame_loggedIn");
    localStorage.removeItem("mygame_user");
    setLoggedIn(false);
    setShowProfile(false);
    setProfileUser(undefined);
    setCurrentUser({ nickname: "", avatar: "", loggedIn: false });
    setFormData({
      department: "",
      name: "",
      nickname: "",
      avatar: "",
    });
    setShowLogin(false);
  }

  // 遊戲創作者數據 (保持不變)
const creators = [
    { 
      name: "宋哲寧 - 射擊", 
      url: "https://julinsung.github.io/killfish/index03.html" 
    },
    { 
      name: "宋哲寧 - 部位", 
      url: "https://julinsung.github.io/bodyparts/index02.html" 
    },
    { 
      name: "宋哲寧 - 動物", 
      url: "https://julinsung.github.io/animallab/index.html" 
    },
  ];


  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        // 確保背景圖由 main 負責
        backgroundImage: "url('/game_00.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {/* 可模糊的整個舞台區塊，showProfile 時套用 filter */}
      <div
        style={{
          width: "100%",
          height: "100%",
          filter: showProfile ? "blur(6px) saturate(0.9)" : "none",
          transition: "filter 200ms ease",
        }}
      >
        {/* 舞台 (1280x720) */}
        <div
          style={{
            width: "1280px",
            height: "720px",
            position: "absolute",
            top: `${offsetY}px`,
            left: `${offsetX}px`,
            // 修正：使用 Math.min 確保內容完整顯示
            transform: `scale(${scale})`, 
            transformOrigin: "top left",
          }}
        >

          {/* 遊戲創作者連結區塊 (中間上方) - 調整大小 */}
          <div
            style={{
              position: "absolute",
              top: "120px", // 設置在畫面上方，避免遮擋左上角頭像區
              left: "50%",
              transform: "translateX(-50%)", // 水平居中
              zIndex: 9999,
              display: "flex",
              flexDirection: "row", // 水平排列
              alignItems: "center",
              // --- 縮小 50%：縮小間距 ---
              gap: "8px", 
              padding: "4px 7px", 
              // --------------------------
              borderRadius: "10px",
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(3px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              pointerEvents: "auto",
            }}
          >
            {creators.map((creator) => (
              <a
                key={creator.name}
                href={creator.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "transparent", 
                  color: "#ffc94a", // 醒目的金色/橙色
                  // --- 縮小 50%：縮小內距和字體大小 ---
                  padding: "2px 5px", 
                  borderRadius: "4px",
                  fontSize: "10px", 
                  // ------------------------------------
                  fontWeight: "bold",
                  textDecoration: "none",
                  transition: "color 0.2s, background 0.2s",
                  border: "1px solid rgba(255,200,0,0.3)",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,200,0,0.1)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#ffc94a";
                }}
              >
                {creator.name} 的遊戲
              </a>
            ))}
          </div>


          {/* ChatBox：傳遞 handleOpenProfile 來集中處理 Modal 狀態 */}
          <ChatBox
            currentUser={currentUser}
            onAvatarClick={handleOpenProfile} 
            usePortal={false}
            left="50px"
            bottom="198px"
            width={280}
            height={148}
            bubbleMinHeight={32}
            bubbleVerticalPadding={6}
          />

          {/* 右下角文字區塊 (省略，保持不變) */}
          <div
            style={{
              position: "absolute",
              bottom: "170px",
              right: "45px",
              width: "250px",
              color: "white",
              borderRadius: "10px",
              fontSize: "10px",
              lineHeight: "2",
              zIndex: 9999,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "0px", fontSize: "13px" }}>
              💌注意事項
            </h3>
            <ul style={{ margin: 0, paddingLeft: "0px" }}>
              <li>
                ● 歡迎報名戶外活動，包含桌遊店、密室逃脫等多樣主題，限十人或以上
              </li>
              <li>● 每個月舉行一次主題日活動，有小比賽，獎勵等你拿!</li>
              <li>● 每周遊戲將由參加者自行決定要玩的桌遊品項，共四款</li>
              <li>● 每個月有一周為本社團休息周，不另做公告</li>
              <li>● 遊戲研究社日程規劃，詳細請看遊戲研究社日程表</li>
              <li>● 歡迎推薦遊戲，將視社費狀況進行購買</li>
            </ul>
          </div>

          {/* 公告板圖片 + 可編輯文字 */}
          <div
            style={{
              position: "absolute",
              top: "350px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(600px, 92vw)",
              height: "180px",
              overflow: "hidden",
            }}
          >
            {/* 狀態指示器 */}
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                fontSize: "12px",
                fontWeight: "bold",
                zIndex: 10,
              }}
            >
              {useSupabase ? "🟢 Supabase" : "🟡 LocalStorage"}
            </div>
            
            <img
              src="/game_01.png"
              alt="公告欄"
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                margin: "0 auto",
                transform: "scale(0.9)",
                transformOrigin: "center",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "59%",
                left: "50%",
                transform: "translate(-50%, -50%) scale(0.9)",
                transformOrigin: "center",
                width: "86%",
                height: "120px",
                color: "black",
                fontWeight: "bold",
                fontSize: "10px",
                lineHeight: "18px",
                display: "flex",
                justifyContent: "center",
                alignItems: "stretch",
              }}
            >
              {isEditingAnnouncement ? (
                <textarea
                  value={draftAnnouncement}
                  onChange={(e) => setDraftAnnouncement(e.target.value)}
                  style={{
                    width: "100%",
                    height: "100%",
                    padding: "10px 16px",
                    boxSizing: "border-box",
                    border: "2px solid #ff6b6b",
                    resize: "none",
                    outline: "none",
                    background:
                      "repeating-linear-gradient(to bottom, " +
                      "transparent 0px, " +
                      "transparent 17px, " +
                      "#5c3b1a 17px, " +
                      "#5c3b1a 18px)",
                    backgroundPosition: "0 8px",
                    color: "black",
                    fontSize: "10px",
                    fontWeight: "bold",
                    lineHeight: "18px",
                    whiteSpace: "pre-wrap",
                    overflowY: "auto",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    padding: "10px 16px",
                    boxSizing: "border-box",
                    border: "none",
                    background:
                      "repeating-linear-gradient(to bottom, " +
                      "transparent 0px, " +
                      "transparent 17px, " +
                      "#5c3b1a 17px, " +
                      "#5c3b1a 18px)",
                    backgroundPosition: "0 8px",
                    color: "black",
                    fontSize: "10px",
                    fontWeight: "bold",
                    lineHeight: "18px",
                    whiteSpace: "pre-wrap",
                    overflowY: "auto",
                  }}
                >
                  {announcements}
                </div>
              )}
            </div>
            
            {/* 編輯按鈕區 */}
            <div
              style={{
                position: "absolute",
                bottom: "3%",
                right: "8%",
                display: "flex",
                gap: "6px",
                zIndex: 10,
              }}
            >
              {!isEditingAnnouncement ? (
                <button
                  onClick={handleStartEditAnnouncement}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid white",
                    background: "rgba(255, 255, 255, 0.35)",
                    color: "#222",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  編輯
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSaveAnnouncement}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid white",
                      background: "rgba(144, 238, 144, 0.55)",
                      color: "#1b1b1b",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    }}
                  >
                    儲存
                  </button>
                  <button
                    onClick={handleCancelEditAnnouncement}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid white",
                      background: "rgba(255, 255, 255, 0.35)",
                      color: "#222",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    }}
                  >
                    取消
                  </button>
                </>
              )}
            </div>
          </div>


          {/* 導覽列 (省略，保持不變) */}
          <nav
            style={{
              position: "absolute",
              bottom: "12%",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "0px 5px",
              borderRadius: "8px",
              display: "flex",
              gap: "0",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 15%, rgba(0,0,0,0.7) 85%, rgba(0,0,0,0) 100%)",
            }}
          >
            {[
              { href: "/about", label: "關於我們" },
              { href: "/register", label: "活動報名" },
              { href: "/vote", label: "桌遊投票" },
              { href: "/shop", label: "推薦購買" },
              { href: "/gallery", label: "活動劇照" },
              { href: "/calendar", label: "遊研行事曆" },
            ].map((item, index, arr) => (
              <React.Fragment key={item.href}>
                <Link
                  href={item.href}
                  style={{
                    padding:
                      "clamp(6px, 0.8vw, 12px) clamp(12px, 1.5vw, 18px)",
                    color: "white",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    fontSize: "clamp(12px, 1.2vw, 12px)",
                    lineHeight: "1.5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.label}
                </Link>
                {index < arr.length - 1 && (
                  <span
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      margin: "0 6px",
                    }}
                  >
                    |
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
          
          {/* 右下角 "遊戲研究社" 圖片 - 保持不變 */}
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              right: "40px",
              width: "250px",
              height: "70px",
              zIndex: 9999,
              pointerEvents: "none", 
            }}
          >

          </div>


          {/* 左上角頭像區塊 */}
          {loggedIn && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "10px",
                width: "200px",
                height: "80px",
                boxSizing: "border-box",
                zIndex: 9999,
                borderRadius: "8px",
                overflow: "hidden",
                backgroundImage: "url('/game_03.png')",
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
                color: "white",
                display: "flex",
                alignItems: "center",
                padding: "0 10px 0 46px",
              }}
            >
              {/* 人物資訊按鈕 - 點擊時呼叫 handleOpenProfile */}
              <div
                onClick={() => handleOpenProfile({
                    nickname: formData.nickname,
                    avatar: currentUser.avatar || formData.avatar,
                    profession: currentProfession,
                    loginDays,
                })}
                style={{
                  position: "absolute",
                  bottom: -8,
                  right: -15,
                  width: "100px",
                  height: "40px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: "bold",
                  color: "#fff",
                  textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
                  zIndex: 11000,
                  pointerEvents: "auto",
                }}
              >
                人物資訊
              </div>

              {/* 頭像預覽 - 點擊時呼叫 handleOpenProfile */}
              <div
                onClick={() => handleOpenProfile({
                    nickname: formData.nickname,
                    avatar: currentUser.avatar || formData.avatar,
                    profession: currentProfession,
                    loginDays,
                })}
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "18px",
                  width: "41px",
                  height: "41px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 11000,
                  pointerEvents: "auto",
                }}
              >
                <img
                  key={currentUser.avatar || formData.avatar || "/game_04.png"}
                  src={currentUser.avatar || formData.avatar || "/game_04.png"}
                  alt="頭像"
                  onError={(e) => {
                    (e.currentTarget as any).src = "/game_04.png";
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>

              {/* 白色橫線 (省略) */}
              <div
                style={{
                  position: "absolute",
                  top: "41px",
                  left: "66px",
                  width: "116px",
                  height: "1px",
                  opacity: 0.9,
                  zIndex: 9999,
                  backgroundColor: "rgba(255, 255, 255, 0.4)",
                }}
              />

              {/* 文字與進度主體 (省略) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  zIndex: 2,
                }}
              >
                {/* 左側：暱稱+職業 */}
                <div
                  style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "65px",
                      top: "30%",
                      fontSize: "14px",
                      fontWeight: "bold",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "160px",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
                    }}
                  >
                    {formData.nickname}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: "100px",
                      top: "28%",
                      fontSize: "9px",
                      color: "rgba(255,255,255,0.95)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "160px",
                      marginTop: "2px",
                    }}
                  >
                    {currentProfession}
                  </div>
                </div>

                {/* 右側：登入天數進度條 */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "65px",
                      top: "59%",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: "80px",
                        height: "6px",
                        backgroundColor: "#333",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${(loginDays / 30) * 100}%`,
                          height: "100%",
                          backgroundColor: "limegreen",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        position: "absolute",
                        left: "80px",
                        fontSize: "8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {loginDays} / 30 天數
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ProfileModal - 集中管理 (解決關閉按鈕失效問題) */}
      {showProfile && profileUser && (
        <ProfileModal
          user={profileUser}
          onClose={() => {
            setShowProfile(false);
            setProfileUser(undefined);
          }}
        />
      )}

      {/* 右上角 LOG IN/LOG OUT & 登入視窗 & 提示 (省略，保持不變) */}
      {!loggedIn && (
        <button
          onClick={() => setShowLogin(true)}
          style={{
            position: "absolute",
            top: "20px",
            right: "40px",
            background: "rgba(0,0,0,0.6)",
            color: "white",
            padding: "0.3vw 0.5vw",
            borderRadius: "5px",
            border: "1px solid white",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "0.9vw",
            zIndex: 9999,
          }}
        >
          LOG IN
        </button>
      )}

      {showLogin && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 9999,
          }}
          onClick={() => setShowLogin(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "434px",
              height: "302px",
              backgroundImage: "url('/login_bg.png')",
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          >
            {/* X 圖片按鈕 */}
            <img
              src="/close.png"
              alt="Close"
              onClick={() => setShowLogin(false)}
              style={{
                position: "absolute",
                top: "15px",
                right: "30px",
                width: "36px",
                height: "32px",
                cursor: "pointer",
                zIndex: 2,
              }}
            />

            {/* 🆕 方框「上傳頭像」按鈕 */}
            <div
              style={{
                position: "absolute",
                top: "56px",
                left: "30%",
                transform: "translateX(-50%)",
                width: "90px",
                height: "32px",
                borderRadius: "6px",
                backgroundColor: "#4a2b16", // 深咖啡
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                zIndex: 3,
                userSelect: "none",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {formData.avatar ? "已上傳頭像" : "上傳頭像"}
            </div>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />

            {/* 職業選擇（可自訂職稱） */}
            <div
              style={{
                position: "absolute",
                top: "83px",
                left: "53%",
                transform: "translateX(-50%)",
                width: "300px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "black",
                fontSize: "15px",
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              {/* 左箭頭透明按鈕 */}
              <button
                onClick={handlePrevJob}
                style={{
                  position: "absolute",
                  left: "82px",
                  top: "18px",
                  width: "30px",
                  height: "30px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                aria-label="Prev"
              />

              {/* 中間職業名稱 / 自訂職稱輸入 */}
              <input
                type="text"
                value={customProfession || professions[jobIndex]}
                onChange={(e) => setCustomProfession(e.target.value)}
                placeholder="選擇或輸入職稱"
                autoComplete="off"
                style={{
                  width: "180px",
                  textAlign: "center",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "black",
                  fontSize: 15,
                  fontWeight: "bold",
                }}
              />

              {/* 右箭頭透明按鈕 */}
              <button
                onClick={handleNextJob}
                style={{
                  position: "absolute",
                  right: "48px",
                  top: "18px",
                  width: "30px",
                  height: "30px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                aria-label="Next"
              />
            </div>

            {/* 透明輸入欄：部門 / 姓名 / 暱稱 (省略) */}
            <input
              type="text"
              value={formData.department}
              onChange={(e) =>
                setFormData({ ...formData, department: e.target.value })
              }
              placeholder=""
              autoComplete="off"
              style={{
                position: "absolute",
                top: "125px",
                left: "26px",
                width: "305px",
                height: "28px",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffffff",
                fontSize: 14,
                textAlign: "center",
              }}
            />
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder=""
              autoComplete="off"
              style={{
                position: "absolute",
                top: "154px",
                left: "26px",
                width: "305px",
                height: "28px",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffffff",
                fontSize: 14,
                textAlign: "center",
              }}
            />
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) =>
                setFormData({ ...formData, nickname: e.target.value })
              }
              placeholder=""
              autoComplete="off"
              style={{
                position: "absolute",
                top: "183px",
                left: "20px",
                width: "305px",
                height: "28px",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffffff",
                fontSize: 14,
                textAlign: "center",
              }}
            />

            {/* 透明 OK 按鈕 */}
            {/* 在 OK 按鈕上方顯示說明文字 */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                top: "218px",
                minWidth: "180px",
                padding: "8px 10px",
                textAlign: "center",
                color: "#000",
                background: "#ffffff",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 800,
                zIndex: 99999,
                userSelect: "none",
                boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
                pointerEvents: "none",
              }}
            >
              部門、姓名、暱稱即帳號
            </div>
            <button
              onClick={handleLogin}
              style={{
                position: "absolute",
                left: "165px",
                top: "252px",
                width: "108px",
                height: "38px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              aria-label="OK"
            />
          </div>
        </div>
      )}

      {showIncompleteAlert && (
        <div
          role="alertdialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            zIndex: 12000,
          }}
          onClick={() => setShowIncompleteAlert(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111",
              color: "white",
              padding: "20px 24px",
              borderRadius: 10,
              minWidth: 280,
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ marginBottom: 12, fontWeight: 700 }}>
              請輸入完整資訊
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 14,
              }}
            >
              請填寫「部門」與「名字」後再按 OK 登入。
            </div>
            <button
              onClick={() => setShowIncompleteAlert(false)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
                padding: "8px 14px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* 登出按鈕 + 右上角小頭像 */}
      {loggedIn && (
        <>
          <button
            onClick={handleLogout}
            style={{
              position: "absolute",
              top: "20px",
              right: "40px",
              background: "rgba(0,0,0,0.6)",
              color: "white",
              padding: "0.3vw 0.6vw",
              borderRadius: "6px",
              border: "1px solid white",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "0.9vw",
              zIndex: 9999,
            }}
          >
            Log out
          </button>

          <div
            style={{
              position: "absolute",
              top: 65,
              right: 40,
              width: 85,
              maxHeight: 160,
              overflowY: "auto",
              padding: "6px 8px",
              background: "rgba(0,0,0,0.45)",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              zIndex: 9999,
              boxSizing: "border-box",
              transform: `scale(${scale * 0.7})`,
              transformOrigin: "top right",
              willChange: "transform",
              pointerEvents: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "#333",
                  flexShrink: 0,
                }}
              >
                <img
                  src={currentUser.avatar || "/game_04.png"}
                  alt="avatar"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "50%",
                    display: "block",
                  }}
                />
              </div>
              <div
                style={{
                  color: "white",
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  maxWidth: 76,
                }}
              >
                {currentUser.nickname || formData.nickname || "訪客"}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}