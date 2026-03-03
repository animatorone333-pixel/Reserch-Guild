"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface VoteRecord {
  id: number;
  game_name: string;
  game_url?: string | null;
  game_price?: number | null;
  voter_name: string;
  agree_vote: boolean;
  vote_day?: string;
  vote_days?: string[] | null;
  created_at: string;
}

interface GameInputRow {
  id: string;
  selected: boolean;
  gameName: string;
  gameUrl: string;
  gamePrice: string;
}

const createEmptyGameRow = (): GameInputRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  selected: true,
  gameName: "",
  gameUrl: "",
  gamePrice: "",
});

const parseVoteDates = (vote: VoteRecord): string[] => {
  if (Array.isArray(vote.vote_days) && vote.vote_days.length > 0) {
    return vote.vote_days
      .filter((day): day is string => typeof day === "string")
      .map((day) => day.trim())
      .filter((day) => day.length > 0);
  }

  if (typeof vote.vote_day === "string" && vote.vote_day.trim()) {
    return [vote.vote_day.trim()];
  }

  return [];
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
  const [gameRows, setGameRows] = useState<GameInputRow[]>([createEmptyGameRow()]);
  const [voterName, setVoterName] = useState("");
  const [voteDates, setVoteDates] = useState<string[]>(initialVoteDate ? [initialVoteDate] : []);
  const [agreeVote, setAgreeVote] = useState(false);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingVoteId, setEditingVoteId] = useState<number | null>(null);
  const [editingGameName, setEditingGameName] = useState("");
  const [editingGameUrl, setEditingGameUrl] = useState("");
  const [editingGamePrice, setEditingGamePrice] = useState("");
  const [editingVoteDates, setEditingVoteDates] = useState<string[]>(initialVoteDate ? [initialVoteDate] : []);
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

  useEffect(() => {
    void loadVotes();
  }, []);

  const voteStats = useMemo(() => {
    const stats = new Map<string, number>();
    votes.forEach((vote) => {
      const key = vote.game_name.trim();
      stats.set(key, (stats.get(key) ?? 0) + 1);
    });

    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1]);
  }, [votes]);


  const onToggleVoteDate = (date: string) => {
    setVoteDates((prev) =>
      prev.includes(date) ? prev.filter((item) => item !== date) : [...prev, date]
    );
  };

  const onToggleEditingVoteDate = (date: string) => {
    setEditingVoteDates((prev) =>
      prev.includes(date) ? prev.filter((item) => item !== date) : [...prev, date]
    );
  };

  const onAddGameRow = () => {
    setGameRows((prev) => [...prev, createEmptyGameRow()]);
  };

  const onRemoveGameRow = (rowId: string) => {
    setGameRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyGameRow()];
      }
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const onChangeGameRow = (rowId: string, field: "gameName" | "gameUrl" | "gamePrice", value: string) => {
    setGameRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const onToggleGameRowSelected = (rowId: string) => {
    setGameRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              selected: !row.selected,
            }
          : row
      )
    );
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedVoterName = voterName.trim();
    const normalizedVoteDates = voteDates
      .map((date) => date.trim())
      .filter((date) => date.length > 0);

    const normalizedRows = gameRows.map((row) => ({
      ...row,
      gameName: row.gameName.trim(),
      gameUrl: row.gameUrl.trim(),
      gamePrice: row.gamePrice.trim(),
    }));

    const selectedRows = normalizedRows.filter((row) => row.selected);
    const filledRows = selectedRows.filter(
      (row) => row.gameName || row.gameUrl || row.gamePrice
    );

    const submitRows = filledRows.filter((row) => row.gameName);

    if (!trimmedVoterName) {
      setError("請填寫姓名");
      return;
    }

    if (!selectedRows.length) {
      setError("請至少勾選一個遊戲列");
      return;
    }

    if (!filledRows.length) {
      setError("請至少新增一列遊戲資訊");
      return;
    }

    if (!submitRows.length) {
      setError("請至少填寫一個遊戲名稱");
      return;
    }

    const hasPartialRow = filledRows.some((row) => !row.gameName);
    if (hasPartialRow) {
      setError("有列資料未填遊戲名稱，請補上或刪除該列");
      return;
    }

    if (!normalizedVoteDates.length) {
      setError("請至少選擇一個投票日期");
      return;
    }

    const hasInvalidDate = normalizedVoteDates.some((date) => !marchSaturdayOptions.includes(date));
    if (hasInvalidDate) {
      setError("投票日期僅能選擇 2026 年 3 月的星期六");
      return;
    }

    const invalidUrlRow = submitRows.find((row) => {
      if (!row.gameUrl) return false;
      try {
        new URL(row.gameUrl);
        return false;
      } catch {
        return true;
      }
    });
    if (invalidUrlRow) {
      const rowIndex = submitRows.findIndex((row) => row.id === invalidUrlRow.id) + 1;
      setError(`第 ${rowIndex} 列遊戲網址格式不正確`);
      return;
    }

    const invalidPriceRow = submitRows.find(
      (row) => row.gamePrice && Number.isNaN(Number(row.gamePrice))
    );
    if (invalidPriceRow) {
      const rowIndex = submitRows.findIndex((row) => row.id === invalidPriceRow.id) + 1;
      setError(`第 ${rowIndex} 列價格需為數字`);
      return;
    }

    if (!agreeVote) {
      setError("請先勾選同意投票");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      for (const row of submitRows) {
        const response = await fetch("/api/vote-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameName: row.gameName,
            gameUrl: row.gameUrl,
            gamePrice: row.gamePrice,
            voterName: trimmedVoterName,
            voteDates: normalizedVoteDates,
            agreeVote,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "投票失敗");
        }
      }

      setGameRows([createEmptyGameRow()]);
      setVoterName("");
      setAgreeVote(false);
      setVoteDates(initialVoteDate ? [initialVoteDate] : []);
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
      setGameRows([createEmptyGameRow()]);
      setVoterName("");
      setAgreeVote(false);
      setVoteDates(initialVoteDate ? [initialVoteDate] : []);
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
    setEditingGameUrl(typeof vote.game_url === "string" ? vote.game_url : "");
    setEditingGamePrice(
      typeof vote.game_price === "number" && Number.isFinite(vote.game_price)
        ? String(vote.game_price)
        : ""
    );
    const normalizedVoteDates = parseVoteDates(vote);
    setEditingVoteDates(normalizedVoteDates.length > 0 ? normalizedVoteDates : initialVoteDate ? [initialVoteDate] : []);
  };

  const onCancelEditVote = () => {
    setEditingVoteId(null);
    setEditingGameName("");
    setEditingGameUrl("");
    setEditingGamePrice("");
    setEditingVoteDates(initialVoteDate ? [initialVoteDate] : []);
    setIsSavingEdit(false);
    setDeletingVoteId(null);
  };

  const onSaveEditVote = async () => {
    if (!editingVoteId) return;

    const trimmedGameName = editingGameName.trim();
    const trimmedGameUrl = editingGameUrl.trim();
    const trimmedGamePrice = editingGamePrice.trim();
    const normalizedVoteDates = editingVoteDates
      .map((date) => date.trim())
      .filter((date) => date.length > 0);

    if (!trimmedGameName) {
      setError("遊戲名稱不可為空");
      return;
    }

    if (!normalizedVoteDates.length) {
      setError("請至少選擇一個投票日期");
      return;
    }

    if (normalizedVoteDates.some((date) => !marchSaturdayOptions.includes(date))) {
      setError("投票日期僅能選擇 2026 年 3 月的星期六");
      return;
    }

    if (trimmedGameUrl) {
      try {
        new URL(trimmedGameUrl);
      } catch {
        setError("遊戲網址格式不正確");
        return;
      }
    }

    if (trimmedGamePrice && Number.isNaN(Number(trimmedGamePrice))) {
      setError("價格需為數字");
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
          gameUrl: trimmedGameUrl,
          gamePrice: trimmedGamePrice,
          voteDates: normalizedVoteDates,
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
          <h2 style={{ margin: "0 0 10px" }}>投票日期（可複選）</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {marchSaturdayOptions.map((date) => (
              <label key={date} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={voteDates.includes(date)}
                  onChange={() => onToggleVoteDate(date)}
                />
                {date}
              </label>
            ))}
          </div>
        </section>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>遊戲資訊（表格）</span>
              <button
                type="button"
                onClick={onAddGameRow}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2f7d32",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                新增一列
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>
                      勾選
                    </th>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>
                      遊戲名稱
                    </th>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>
                      遊戲網址
                    </th>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>
                      價格
                    </th>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd", width: 88 }}>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gameRows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => onToggleGameRowSelected(row.id)}
                        />
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                        <input
                          type="text"
                          value={row.gameName}
                          onChange={(e) => onChangeGameRow(row.id, "gameName", e.target.value)}
                          placeholder="例如：奪魂鋸密室"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #ccc",
                            color: "#000",
                            background: "#fff",
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                        <input
                          type="url"
                          value={row.gameUrl}
                          onChange={(e) => onChangeGameRow(row.id, "gameUrl", e.target.value)}
                          placeholder="https://..."
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #ccc",
                            color: "#000",
                            background: "#fff",
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                        <input
                          type="text"
                          value={row.gamePrice}
                          onChange={(e) => onChangeGameRow(row.id, "gamePrice", e.target.value)}
                          placeholder="例如：800"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #ccc",
                            color: "#000",
                            background: "#fff",
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                        <button
                          type="button"
                          onClick={() => onRemoveGameRow(row.id)}
                          style={{
                            padding: "6px 10px",
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
                          {vote.game_name}
                          {vote.game_url ? (
                            <>
                              {" "}
                              ｜
                              {" "}
                              <a href={vote.game_url} target="_blank" rel="noreferrer">
                                連結
                              </a>
                            </>
                          ) : null}
                          {typeof vote.game_price === "number" ? ` ｜ 價格：${vote.game_price}` : ""} ｜ {vote.voter_name} ｜ 日期：
                          {parseVoteDates(vote).join(", ") || vote.created_at.slice(0, 10)} ｜ {vote.agree_vote ? "☑ 已勾選" : "☐ 未勾選"}
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
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>
                                  遊戲名稱
                                </th>
                                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>
                                  遊戲網址
                                </th>
                                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>
                                  價格
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                                  <input
                                    type="text"
                                    value={editingGameName}
                                    onChange={(e) => setEditingGameName(e.target.value)}
                                    placeholder="請輸入遊戲名稱"
                                    style={{
                                      width: "100%",
                                      padding: "8px 10px",
                                      borderRadius: 8,
                                      border: "1px solid #ccc",
                                      color: "#000",
                                      background: "#fff",
                                    }}
                                  />
                                </td>
                                <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                                  <input
                                    type="url"
                                    value={editingGameUrl}
                                    onChange={(e) => setEditingGameUrl(e.target.value)}
                                    placeholder="https://..."
                                    style={{
                                      width: "100%",
                                      padding: "8px 10px",
                                      borderRadius: 8,
                                      border: "1px solid #ccc",
                                      color: "#000",
                                      background: "#fff",
                                    }}
                                  />
                                </td>
                                <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                                  <input
                                    type="text"
                                    value={editingGamePrice}
                                    onChange={(e) => setEditingGamePrice(e.target.value)}
                                    placeholder="例如：800"
                                    style={{
                                      width: "100%",
                                      padding: "8px 10px",
                                      borderRadius: 8,
                                      border: "1px solid #ccc",
                                      color: "#000",
                                      background: "#fff",
                                    }}
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {marchSaturdayOptions.map((date) => (
                            <label key={date} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="checkbox"
                                checked={editingVoteDates.includes(date)}
                                onChange={() => onToggleEditingVoteDate(date)}
                              />
                              {date}
                            </label>
                          ))}
                        </div>
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
      </div>
    </main>
  );
}
