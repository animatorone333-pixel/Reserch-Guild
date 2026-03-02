"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface VoteRecord {
  id: number;
  game_name: string;
  voter_name: string;
  agree_vote: boolean;
  vote_day?: string;
  created_at: string;
}

const GAME_OPTIONS_STORAGE_KEY = "escape_room_vote_game_options_v1";
const GAME_OPTIONS_SCOPE = "vote-room";

const loadGameOptions = (): string[] => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(GAME_OPTIONS_STORAGE_KEY);
  if (!raw) return [];

  try {
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

export default function VoteRoomPage() {
  const toLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const marchSaturdayOptions = useMemo(() => {
    const options: string[] = [];
    const year = 2026;
    const march = 2;

    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, march, day);
      if (date.getMonth() !== march) break;
      if (date.getDay() === 6) {
        options.push(toLocalDateString(date));
      }
    }

    return options;
  }, []);

  const initialVoteDate = marchSaturdayOptions[0] || "";
  const [gameName, setGameName] = useState("");
  const [newGameName, setNewGameName] = useState("");
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [voterName, setVoterName] = useState("");
  const [voteDate, setVoteDate] = useState(initialVoteDate);
  const [agreeVote, setAgreeVote] = useState(false);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [gameOptions, setGameOptions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingVoteId, setEditingVoteId] = useState<number | null>(null);
  const [editingGameName, setEditingGameName] = useState("");
  const [editingVoteDate, setEditingVoteDate] = useState(initialVoteDate);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingVoteId, setDeletingVoteId] = useState<number | null>(null);

  const loadVotes = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/vote-room", { cache: "no-store" });
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

  const loadGameOptionsFromApi = async () => {
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
      setGameOptions(loadGameOptions());
    }
  };

  useEffect(() => {
    void loadVotes();
    void loadGameOptionsFromApi();
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
    const allNames = [...gameOptions, ...votes.map((vote) => vote.game_name)];
    return Array.from(new Set(allNames.map((name) => name.trim()).filter((name) => name.length > 0)));
  }, [gameOptions, votes]);

  const onAddGameOption = async () => {
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

      await loadGameOptionsFromApi();
    } catch {
      setGameOptions((prev) => [...prev, trimmed]);
    }

    setGameName(trimmed);
    setNewGameName("");
    setError("");
    setShowAddGameModal(false);
  };

  const onDeleteGameOption = async (optionName: string) => {
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

      await loadGameOptionsFromApi();
    } catch {
      setGameOptions((prev) => prev.filter((name) => name !== optionName));
    }

    if (gameName.trim() === optionName.trim()) {
      setGameName("");
    }
    setError("");
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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

    if (!marchSaturdayOptions.includes(trimmedVoteDate)) {
      setError("投票日期僅能選擇 3 月的星期六");
      return;
    }

    if (!agreeVote) {
      setError("請先勾選同意投票");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/vote-room", {
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
      setVoteDate(initialVoteDate);
      await loadVotes();
    } catch (e: any) {
      setError(e?.message || "投票失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetVotes = async () => {
    const confirmed = window.confirm("確定要清空目前所有投票紀錄嗎？");
    if (!confirmed) return;

    setError("");
    setIsResetting(true);
    try {
      const response = await fetch("/api/vote-room", { method: "DELETE" });
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

  const onStartEditVote = (vote: VoteRecord) => {
    setError("");
    setEditingVoteId(vote.id);
    setEditingGameName(vote.game_name);
    setEditingVoteDate(vote.vote_day || initialVoteDate);
  };

  const onCancelEditVote = () => {
    setEditingVoteId(null);
    setEditingGameName("");
    setEditingVoteDate(initialVoteDate);
    setIsSavingEdit(false);
    setDeletingVoteId(null);
  };

  const onSaveEditVote = async () => {
    if (!editingVoteId) return;

    const trimmedGameName = editingGameName.trim();
    const trimmedVoteDate = editingVoteDate.trim();

    if (!trimmedGameName) {
      setError("遊戲名稱不可為空");
      return;
    }

    if (!marchSaturdayOptions.includes(trimmedVoteDate)) {
      setError("投票日期僅能選擇 2026 年 3 月的星期六");
      return;
    }

    setError("");
    setIsSavingEdit(true);
    try {
      const response = await fetch("/api/vote-room", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingVoteId,
          gameName: trimmedGameName,
          voteDate: trimmedVoteDate,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "修改投票失敗");
      }

      onCancelEditVote();
      await loadVotes();
    } catch (e: any) {
      setError(e?.message || "修改投票失敗");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const onDeleteVote = async (voteId: number) => {
    const confirmed = window.confirm("確定要刪除這筆投票紀錄嗎？");
    if (!confirmed) return;

    setError("");
    setDeletingVoteId(voteId);
    try {
      const response = await fetch(`/api/vote-room?id=${voteId}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "刪除投票失敗");
      }

      if (editingVoteId === voteId) {
        onCancelEditVote();
      }
      await loadVotes();
    } catch (e: any) {
      setError(e?.message || "刪除投票失敗");
    } finally {
      setDeletingVoteId(null);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f7f9",
        padding: "32px 16px",
        color: "#000",
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>密室逃脫 / 劇本殺投票</h1>
        <p style={{ marginTop: 0, color: "#555" }}>
          請填寫想玩的遊戲名稱與你的姓名，再勾選投票。
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
            onClick={onResetVotes}
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
              borderRadius: 8,
              border: "none",
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
                    onClick={() => void onDeleteGameOption(name)}
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

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          <label style={{ display: "grid", gap: 6 }}>
            遊戲名稱
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              list="escape-room-game-options"
              placeholder="例如：奪魂鋸密室、古宅劇本殺"
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                color: "#000",
                background: "#fff",
              }}
            />
            <datalist id="escape-room-game-options">
              {selectableGameNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            姓名
            <input
              type="text"
              value={voterName}
              onChange={(e) => setVoterName(e.target.value)}
              placeholder="請輸入你的姓名"
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
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
                borderRadius: 8,
                border: "1px solid #ccc",
                color: "#000",
                background: "#fff",
              }}
            >
              {marchSaturdayOptions.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={agreeVote}
              onChange={(e) => setAgreeVote(e.target.checked)}
            />
            我確認以上資訊正確，並送出投票
          </label>

          {error && <p style={{ margin: 0, color: "#c62828" }}>{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: isSubmitting ? "#8aa5d8" : "#1f6feb",
              color: "#fff",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {isSubmitting ? "送出中..." : "送出投票"}
          </button>
        </form>

        <section style={{ marginBottom: 20 }}>
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
              {votes.map((vote) => {
                const isEditing = editingVoteId === vote.id;

                return (
                  <li key={vote.id}>
                    {!isEditing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span>
                          {vote.game_name} ｜ {vote.voter_name} ｜ 日期：{vote.vote_day || vote.created_at.slice(0, 10)} ｜ {vote.agree_vote ? "☑ 已勾選" : "☐ 未勾選"}
                        </span>
                        <button
                          type="button"
                          onClick={() => onStartEditVote(vote)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "none",
                            background: "#1976d2",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          修改
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          border: "1px solid #ddd",
                          borderRadius: 8,
                          padding: 10,
                          background: "#fafafa",
                        }}
                      >
                        <div style={{ fontSize: 13, color: "#555" }}>編輯：{vote.voter_name} 的投票</div>
                        <input
                          type="text"
                          value={editingGameName}
                          onChange={(e) => setEditingGameName(e.target.value)}
                          list="escape-room-game-options"
                          placeholder="請輸入遊戲名稱"
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #ccc",
                            color: "#000",
                            background: "#fff",
                          }}
                        />
                        <select
                          value={editingVoteDate}
                          onChange={(e) => setEditingVoteDate(e.target.value)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #ccc",
                            color: "#000",
                            background: "#fff",
                          }}
                        >
                          {marchSaturdayOptions.map((date) => (
                            <option key={date} value={date}>
                              {date}
                            </option>
                          ))}
                        </select>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => void onSaveEditVote()}
                            disabled={isSavingEdit}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "none",
                              background: isSavingEdit ? "#8aa5d8" : "#1f6feb",
                              color: "#fff",
                              cursor: isSavingEdit ? "not-allowed" : "pointer",
                              fontSize: 12,
                            }}
                          >
                            {isSavingEdit ? "儲存中..." : "儲存修改"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteVote(vote.id)}
                            disabled={deletingVoteId === vote.id}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "none",
                              background: deletingVoteId === vote.id ? "#d8a1a1" : "#d32f2f",
                              color: "#fff",
                              cursor: deletingVoteId === vote.id ? "not-allowed" : "pointer",
                              fontSize: 12,
                            }}
                          >
                            {deletingVoteId === vote.id ? "刪除中..." : "刪除這筆"}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditVote}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #ccc",
                              background: "#fff",
                              color: "#222",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
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
                placeholder="例如：古宅驚魂"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
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
                  onClick={() => void onAddGameOption()}
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
