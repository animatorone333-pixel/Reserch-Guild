"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type OutdoorVote = {
  id: number;
  game_name: string;
  voter_name: string;
  agree_vote: boolean;
  vote_day?: string;
  created_at: string;
};

const GAME_OPTIONS_STORAGE_KEY = "outdoor_vote_game_options_v1";
const GAME_OPTIONS_SCOPE = "outdoor-vote";

const loadStoredGameOptions = (): string[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(GAME_OPTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
};

export default function OutdoorVotePage() {
  const toLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const weekendOptions = useMemo(() => {
    const options: string[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    for (let i = 0; options.length < 24 && i < 120; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const day = d.getDay();
      if (day === 0 || day === 6) {
        options.push(toLocalDateString(d));
      }
    }
    return options;
  }, []);

  const initialWeekendDate = weekendOptions[0] || toLocalDateString(new Date());
  const [gameName, setGameName] = useState("");
  const [newGameName, setNewGameName] = useState("");
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [voterName, setVoterName] = useState("");
  const [voteDate, setVoteDate] = useState(initialWeekendDate);
  const [agreeVote, setAgreeVote] = useState(false);
  const [votes, setVotes] = useState<OutdoorVote[]>([]);
  const [gameOptions, setGameOptions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadGameOptions = async () => {
    try {
      const response = await fetch(`/api/vote-game-options?scope=${GAME_OPTIONS_SCOPE}`, {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result?.success || !Array.isArray(result?.data)) {
        throw new Error("讀取共用遊戲清單失敗");
      }

      setGameOptions(result.data);
      return;
    } catch {
      setGameOptions(loadStoredGameOptions());
    }
  };

  const loadVotes = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/outdoor-vote", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "讀取投票失敗");
      }

      setVotes(Array.isArray(result.data) ? result.data : []);
    } catch (e: any) {
      setError(e?.message || "讀取投票失敗");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadVotes();
    void loadGameOptions();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(GAME_OPTIONS_STORAGE_KEY, JSON.stringify(gameOptions));
    }
  }, [gameOptions]);

  const voteStats = useMemo(() => {
    const stats = new Map<string, number>();

    votes.forEach((vote) => {
      const key = vote.game_name.trim();
      stats.set(key, (stats.get(key) ?? 0) + 1);
    });

    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1]);
  }, [votes]);

  const selectableGameNames = useMemo(() => {
    const allNames = [
      ...gameOptions,
      ...votes.map((vote) => vote.game_name),
    ];

    return Array.from(
      new Set(
        allNames
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
      )
    );
  }, [gameOptions, votes]);

  const handleAddGameOption = async () => {
    const trimmed = newGameName.trim();
    if (!trimmed) {
      setError("請先輸入要新增的遊戲名稱");
      return;
    }

    if (gameOptions.some((name) => name.toLowerCase() === trimmed.toLowerCase())) {
      setGameName(trimmed);
      setNewGameName("");
      setError("");
      return;
    }

    try {
      const response = await fetch("/api/vote-game-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: GAME_OPTIONS_SCOPE,
          optionName: trimmed,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "新增遊戲失敗");
      }

      await loadGameOptions();
    } catch {
      setGameOptions((prev) => [...prev, trimmed]);
    }

    setGameName(trimmed);
    setNewGameName("");
    setError("");
    setShowAddGameModal(false);
  };

  const handleDeleteGameOption = async (optionName: string) => {
    try {
      const response = await fetch("/api/vote-game-options", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: GAME_OPTIONS_SCOPE,
          optionName,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "刪除遊戲失敗");
      }

      await loadGameOptions();
    } catch {
      setGameOptions((prev) => prev.filter((name) => name !== optionName));
    }

    if (gameName.trim() === optionName.trim()) {
      setGameName("");
    }
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedGameName = gameName.trim();
    const trimmedVoterName = voterName.trim();
    const trimmedVoteDate = voteDate.trim();

    if (!trimmedGameName || !trimmedVoterName) {
      setError("請填寫遊戲名稱與姓名");
      return;
    }

    if (!trimmedVoteDate) {
      setError("請選擇投票日期");
      return;
    }

    if (!agreeVote) {
      setError("請先勾選同意投票");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/outdoor-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameName: trimmedGameName,
          voterName: trimmedVoterName,
          voteDate: trimmedVoteDate,
          agreeVote,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "投票失敗");
      }

      setGameName("");
      setVoterName("");
      setAgreeVote(false);
      setVoteDate(initialWeekendDate);
      await loadVotes();
    } catch (e: any) {
      setError(e?.message || "投票失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetVotes = async () => {
    const confirmed = window.confirm("確定要清空目前所有投票紀錄嗎？");
    if (!confirmed) return;

    setError("");
    setIsResetting(true);
    try {
      const response = await fetch("/api/outdoor-vote", {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "重新投票失敗");
      }

      setVotes([]);
      setGameName("");
      setVoterName("");
      setAgreeVote(false);
    } catch (e: any) {
      setError(e?.message || "重新投票失敗");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        padding: "32px 16px",
        color: "#000",
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>戶外桌遊投票區</h1>
        <p style={{ marginTop: 0, color: "#555" }}>
          請填寫想玩的戶外桌遊、姓名，並勾選確認後送出。
        </p>

        <div style={{ marginBottom: 20 }}>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: 8,
              background: "#eceff4",
              color: "#222",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            回首頁
          </Link>
          <button
            type="button"
            onClick={() => void handleResetVotes()}
            disabled={isResetting}
            style={{
              marginLeft: 10,
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              background: isResetting ? "#d8a1a1" : "#c62828",
              color: "#fff",
              cursor: isResetting ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {isResetting ? "重置中..." : "重新投票"}
          </button>
        </div>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 10px" }}>可選遊戲清單</h2>
          <button
            type="button"
            onClick={() => setShowAddGameModal(true)}
            style={{
              marginBottom: 10,
              padding: "10px 12px",
              border: "none",
              borderRadius: 8,
              background: "#2f7d32",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            新增遊戲（跳窗）
          </button>

          {selectableGameNames.length === 0 ? (
            <p style={{ margin: 0, color: "#777" }}>目前還沒有可選遊戲，請先新增。</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
              {selectableGameNames.map((name) => (
                <li
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteGameOption(name)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "none",
                      background: "#d32f2f",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    刪除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          <label style={{ display: "grid", gap: 6 }}>
            遊戲名稱
            <input
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              list="outdoor-game-options"
              placeholder="例如：狼人殺（戶外版）"
              style={{
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 8,
                color: "#000",
                background: "#fff",
              }}
            />
            <datalist id="outdoor-game-options">
              {selectableGameNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            姓名
            <input
              value={voterName}
              onChange={(e) => setVoterName(e.target.value)}
              placeholder="請輸入姓名"
              style={{
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 8,
                color: "#000",
                background: "#fff",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            投票日期
            <select
              value={voteDate}
              onChange={(e) => setVoteDate(e.target.value)}
              style={{
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 8,
                color: "#000",
                background: "#fff",
              }}
            >
              {weekendOptions.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={agreeVote}
              onChange={(e) => setAgreeVote(e.target.checked)}
            />
            我確認以上內容正確，送出投票
          </label>

          {error && <p style={{ margin: 0, color: "#c62828" }}>{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "10px 14px",
              border: "none",
              borderRadius: 8,
              background: isSubmitting ? "#8aa5d8" : "#1f6feb",
              color: "#fff",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {isSubmitting ? "送出中..." : "送出投票"}
          </button>
        </form>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 10px" }}>目前票數</h2>
          {voteStats.length === 0 ? (
            <p style={{ margin: 0, color: "#777" }}>目前還沒有投票</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {voteStats.map(([name, count]) => (
                <li key={name}>
                  {name}：{count} 票
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 style={{ margin: "0 0 10px" }}>投票紀錄</h2>
          {isLoading ? (
            <p style={{ margin: 0, color: "#777" }}>載入中...</p>
          ) : votes.length === 0 ? (
            <p style={{ margin: 0, color: "#777" }}>目前沒有紀錄</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
              {votes.map((vote) => (
                <li key={vote.id}>
                  {vote.game_name} ｜ {vote.voter_name} ｜ 日期：{vote.vote_day || vote.created_at.slice(0, 10)} ｜ {vote.agree_vote ? "☑ 已勾選" : "☐ 未勾選"}
                </li>
              ))}
            </ul>
          )}
        </section>

        {showAddGameModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                width: "min(460px, 92vw)",
                background: "#fff",
                borderRadius: 12,
                padding: 18,
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>新增可選遊戲</h3>
              <input
                autoFocus
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="例如：躲避球任務"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  color: "#000",
                  background: "#fff",
                  marginBottom: 12,
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddGameModal(false);
                    setNewGameName("");
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    background: "#fff",
                    color: "#222",
                    cursor: "pointer",
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddGameOption()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2f7d32",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  確認新增
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
