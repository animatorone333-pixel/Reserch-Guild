"use client";
import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
// import ProfileModal from "./ProfileModal"; // 移除，因為改由父元件渲染

type Message = {
  text: string;
  sender: "me" | "other";
  nickname?: string;
  avatar?: string; // 可以是圖片或數字字串
};

let guestCounter = 1; // 全域路人計數器

interface GuestIdentity {
  nickname: string;
  avatar: string;
}

// 訪客身分在 localStorage 使用的 key（只存 "我是路人幾號"）
const GUEST_ID_KEY = "chatbox_guest_identity_v1";

export default function ChatBox({
  currentUser,
  portalScale = 1,
  usePortal = true,
  left = "24px",
  bottom = "40px",
  top,
  right,
  width = 200,
  height = 200,
  bubbleMinHeight = 36,
  bubbleVerticalPadding = 6,
  // 🆕 新增：頭像點擊事件處理
  onAvatarClick, 
}: {
  currentUser?: { nickname: string; avatar?: string; loggedIn?: boolean };
  portalScale?: number;
  usePortal?: boolean;
  left?: string | number;
  bottom?: string | number;
  top?: string | number;
  right?: string | number;
  width?: number | string;
  height?: number | string;
  bubbleMinHeight?: number;
  bubbleVerticalPadding?: number;
  // 🆕 新增：頭像點擊事件處理型別
  onAvatarClick?: (user: { nickname?: string; avatar?: string }) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity | null>(null);

  // 移除：不再在 ChatBox 內部處理 ProfileModal 狀態
  // const [showProfile, setShowProfile] = useState(false);
  // const [selectedUser, setSelectedUser] = useState<{ nickname?: string; profession?: string; loginDays?: number } | null>(null);

  // 在 client mount 後標記已 mount，允許 portal 渲染
  useEffect(() => {
    setMounted(true);
  }, []);

  // 載入本機訪客身分（讓同一個人每次發言都用同一個暱稱）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(GUEST_ID_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.nickname === "string" && typeof parsed.avatar === "string") {
        setGuestIdentity({ nickname: parsed.nickname, avatar: parsed.avatar });

        const num = Number(parsed.avatar);
        if (!isNaN(num) && num >= guestCounter) {
          guestCounter = num + 1;
        }
      }
    } catch (e) {
      console.warn("載入訪客身分失敗", e);
    }
  }, []);

  // 載入歷史訊息：從後端 API 取得共用聊天室紀錄
  useEffect(() => {
    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const res = await fetch("/api/chat");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setMessages(
            data.map((m: any) => ({
              text: m.text,
              nickname: m.nickname,
              avatar: m.avatar,
              sender: "other" as const,
            }))
          );
        }
      } catch (e) {
        console.warn("載入聊天室歷史訊息失敗", e);
      }
    };

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (input.trim() === "") return;

    let nickname = "路人";
    let avatar = "";

    if (currentUser?.loggedIn) {
      nickname = currentUser.nickname || "訪客";
      avatar = currentUser.avatar || "😀";
    } else if (guestIdentity) {
      // 已有本機訪客身分，後續所有訊息都沿用同一個名稱
      nickname = guestIdentity.nickname;
      avatar = guestIdentity.avatar;
    } else {
      // 第一次發言的訪客：產生一個路人編號並記住
      const id = guestCounter++;
      nickname = `路人${id}`;
      avatar = `${id}`; // 數字直接當頭像

      const identity = { nickname, avatar };
      setGuestIdentity(identity);

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(GUEST_ID_KEY, JSON.stringify(identity));
        } catch (e) {
          console.warn("儲存訪客身分失敗", e);
        }
      }
    }

    const text = input.trim();

    // 先在前端立即顯示本次訊息
    setMessages((prev) => [
      ...prev,
      { text, sender: "me", nickname, avatar },
    ]);
    setInput("");

    // 再非同步送到後端儲存，讓其他人也能看到
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, nickname, avatar }),
      });
    } catch (e) {
      console.warn("送出聊天室訊息到伺服器失敗", e);
    }
  };

  const baseStyle: React.CSSProperties = {
    zIndex: 30000,
    background: "rgba(0,0,0,0.6)",
    borderRadius: 5,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: 8,                 
    color: "white",
    fontSize: 11,               
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
    backdropFilter: "blur(4px)",
    boxSizing: "border-box",
  };

  const portalStyle: React.CSSProperties = {
    position: "fixed",
    left: left as any,
    bottom: bottom as any,
    top: top as any,
    right: right as any,
    transform: `scale(${portalScale})`,
    transformOrigin: "left bottom",
    willChange: "transform",
    width,
    height,
    ...baseStyle,
  };

  const inlineStyle: React.CSSProperties = {
    position: "absolute",
    left: left as any,
    bottom: bottom as any,
    top: top as any,
    right: right as any,
    transform: "none",
    width,
    height,
    ...baseStyle,
  };

  const jsx = (
    <div className="chatbox-portal" style={usePortal ? portalStyle : inlineStyle}>
      {/* 標題列 */}
      <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 2 }}>
        訪客聊天室
      </div>

      {/* 訊息列表 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          marginBottom: 5,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: msg.sender === "me" ? "flex-end" : "flex-start",
              gap: 4, 
              alignItems: "center", 
            }}
          >
            {/* 頭像欄（暱稱以絕對定位顯示，不影響列高度） */}
            <div
              style={{
                width: 20, 
                boxSizing: "border-box",
                position: "relative", 
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "gray",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  cursor: "pointer", 
                }}
                // 🆕 修正：點擊時呼叫外部傳入的 onAvatarClick 函數
                onClick={() => {
                  if (onAvatarClick) {
                    onAvatarClick({ nickname: msg.nickname, avatar: msg.avatar });
                  }
                }}
              >
                {isNaN(Number(msg.avatar)) ? (
                  msg.avatar ? (
                    <img
                      src={msg.avatar}
                      alt="avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : null
                ) : (
                  msg.avatar
                )}
              </div>

              {/* 暱稱：絕對定位在頭像下方，不會影響泡泡對齊 */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  top: "calc(100% + 2px)", 
                  fontSize: 8,
                  lineHeight: 1,
                  color: "rgba(255,255,255,0.9)",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                {msg.nickname}
              </div>
            </div>

            {/* 泡泡：垂直置中（會與 avatar 中心對齊） */}
            <div
              style={{
                background:
                  msg.sender === "me"
                    ? "rgba(206, 138, 106, 0.85)"
                    : "rgba(255,255,255,0.08)",
                padding: "6px 10px",
                borderRadius: 6,
                maxWidth: "70%",
                wordBreak: "break-word",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 9, lineHeight: 1.0 }}>{msg.text}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 輸入框 */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          placeholder="輸入訊息..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          style={{
            flex: 1,
            fontSize: 9,
            border: "none",
            outline: "none",
            padding: 8,
            borderRadius: 6,
            background: "rgba(255,255,255,0.06)",
            color: "white",
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: "8px 10px",
            fontSize: 9,
            cursor: "pointer",
            border: "none",
            borderRadius: 6,
            backgroundColor: "#6c4b2a",
            color: "white",
          }}
        >
          送出
        </button>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;

  // 移除：不再渲染內部的 ProfileModal Portal
  return (
    <>
      {usePortal ? ReactDOM.createPortal(jsx, document.body) : jsx}
    </>
  );
}



