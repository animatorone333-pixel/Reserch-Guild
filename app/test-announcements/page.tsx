"use client";

import { useEffect, useState } from "react";

export default function AnnouncementsTestPage() {
  const [announcement, setAnnouncement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newContent, setNewContent] = useState("");
  const [updating, setUpdating] = useState(false);

  // 載入公告
  const loadAnnouncement = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/announcements");
      const data = await response.json();
      
      if (data.success) {
        setAnnouncement(data.data);
        setNewContent(data.data.content);
      } else {
        setError(data.error || "載入失敗");
      }
    } catch (err: any) {
      setError(err.message || "連線失敗");
    } finally {
      setLoading(false);
    }
  };

  // 更新公告
  const updateAnnouncement = async () => {
    setUpdating(true);
    setError(null);
    
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newContent,
          updatedBy: "test-page",
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAnnouncement(data.data);
        alert("✅ 更新成功！");
      } else {
        setError(data.error || "更新失敗");
      }
    } catch (err: any) {
      setError(err.message || "連線失敗");
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    loadAnnouncement();
  }, []);

  return (
    <div style={{ 
      padding: "40px", 
      maxWidth: "800px", 
      margin: "0 auto",
      fontFamily: "system-ui, sans-serif"
    }}>
      <h1 style={{ marginBottom: "20px" }}>
        🧪 公告功能測試頁面
      </h1>
      
      <div style={{ 
        background: "#f5f5f5", 
        padding: "20px", 
        borderRadius: "8px",
        marginBottom: "20px"
      }}>
        <h2 style={{ margin: "0 0 10px 0" }}>環境資訊</h2>
        <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
          <div>
            Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ 已設定" : "❌ 未設定"}
          </div>
          <div>
            Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ 已設定" : "❌ 未設定"}
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          載入中...
        </div>
      )}

      {error && (
        <div style={{ 
          background: "#fee", 
          color: "#c00", 
          padding: "15px", 
          borderRadius: "5px",
          marginBottom: "20px"
        }}>
          <strong>❌ 錯誤：</strong> {error}
          <div style={{ marginTop: "10px", fontSize: "14px" }}>
            <strong>可能原因：</strong>
            <ul style={{ margin: "5px 0 0 20px" }}>
              <li>Supabase API key 格式不正確（需要 eyJ 開頭）</li>
              <li>announcements 資料表尚未建立</li>
              <li>RLS 政策未設定</li>
            </ul>
            <div style={{ marginTop: "10px" }}>
              📚 請參考：<code>docs/ANNOUNCEMENTS_QUICKSTART.md</code>
            </div>
          </div>
        </div>
      )}

      {announcement && (
        <>
          <div style={{ 
            background: "#efe", 
            padding: "20px", 
            borderRadius: "8px",
            marginBottom: "20px"
          }}>
            <h2 style={{ margin: "0 0 15px 0" }}>✅ 當前公告</h2>
            <div style={{ 
              background: "white", 
              padding: "15px", 
              borderRadius: "5px",
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              fontSize: "14px",
              marginBottom: "10px"
            }}>
              {announcement.content}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              📅 更新時間: {new Date(announcement.updated_at).toLocaleString("zh-TW")}
              <br />
              👤 更新者: {announcement.updated_by}
            </div>
          </div>

          <div style={{ 
            background: "#f5f5f5", 
            padding: "20px", 
            borderRadius: "8px"
          }}>
            <h2 style={{ margin: "0 0 15px 0" }}>✏️ 編輯公告</h2>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              style={{
                width: "100%",
                minHeight: "150px",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "5px",
                fontFamily: "monospace",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
            <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
              <button
                onClick={updateAnnouncement}
                disabled={updating}
                style={{
                  padding: "10px 20px",
                  background: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: updating ? "not-allowed" : "pointer",
                  opacity: updating ? 0.6 : 1,
                }}
              >
                {updating ? "更新中..." : "💾 儲存公告"}
              </button>
              <button
                onClick={loadAnnouncement}
                style={{
                  padding: "10px 20px",
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                🔄 重新載入
              </button>
              <button
                onClick={() => setNewContent(announcement.content)}
                style={{
                  padding: "10px 20px",
                  background: "#ffc107",
                  color: "#000",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                ↩️ 還原
              </button>
            </div>
          </div>

          <div style={{ 
            marginTop: "20px", 
            padding: "15px", 
            background: "#e7f3ff",
            borderRadius: "5px",
            fontSize: "14px"
          }}>
            <strong>💡 測試即時同步：</strong>
            <ol style={{ margin: "10px 0 0 20px" }}>
              <li>開啟另一個瀏覽器視窗（或無痕模式）</li>
              <li>同樣訪問此測試頁面或首頁</li>
              <li>在這裡修改公告並儲存</li>
              <li>另一個視窗應在 1-2 秒內自動更新（無需重新整理）</li>
            </ol>
          </div>
        </>
      )}

      <div style={{ 
        marginTop: "30px", 
        paddingTop: "20px", 
        borderTop: "1px solid #ddd",
        fontSize: "14px",
        color: "#666"
      }}>
        <strong>📚 相關連結：</strong>
        <ul style={{ marginTop: "10px" }}>
          <li><a href="/">← 返回首頁</a></li>
          <li><a href="https://github.com/animatorone333-pixel/Reserch-Guild/blob/main/docs/ANNOUNCEMENTS_QUICKSTART.md" target="_blank">快速設定指南</a></li>
          <li><a href="https://github.com/animatorone333-pixel/Reserch-Guild/blob/main/docs/ANNOUNCEMENTS_MANAGEMENT.md" target="_blank">完整管理文件</a></li>
        </ul>
      </div>
    </div>
  );
}
