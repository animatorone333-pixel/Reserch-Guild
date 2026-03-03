"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface VoteRecord {
  id: number;
  game_name: string;
  game_url?: string | null;
  game_price?: string | null;
  voter_name: string;
  agree_vote: boolean;
  vote_day?: string;
  vote_days?: string[] | null;
  created_at: string;
}

interface GameInputRow {
  id: string;
  gameName: string;
  gameUrl: string;
  gamePrice: string;
}

interface VoteGameOption {
  id: string;
  gameName: string;
  gameUrl: string;
  gamePrice: string;
}

const ALL_GAMES_OPTION_ID = "__ALL_GAMES__";

const createEmptyGameRow = (): GameInputRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
  const [currentVoteGames, setCurrentVoteGames] = useState<VoteGameOption[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [voterName, setVoterName] = useState("");
  const [voteDates, setVoteDates] = useState<string[]>(initialVoteDate ? [initialVoteDate] : []);
  const [agreeVote, setAgreeVote] = useState(false);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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

  const loadVoteGames = async () => {
    try {
      const response = await fetch("/api/vote-room-games", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok || !result?.success || !Array.isArray(result?.data)) {
        throw new Error(result?.error || "讀取本次遊戲清單失敗");
      }

      const games: VoteGameOption[] = result.data.map((item: any) => ({
        id: String(item.id),
        gameName: typeof item?.game_name === "string" ? item.game_name : "",
        gameUrl: typeof item?.game_url === "string" ? item.game_url : "",
        gamePrice: typeof item?.game_price === "string" ? item.game_price : "",
      }));

      setCurrentVoteGames(games);
      setSelectedGameIds([]);
      setGameRows(
        games.length > 0
          ? games.map((game) => ({
              id: game.id,
              gameName: game.gameName,
              gameUrl: game.gameUrl,
              gamePrice: game.gamePrice,
            }))
          : [createEmptyGameRow()]
      );
    } catch (e: any) {
      setError(e?.message || "讀取本次遊戲清單失敗");
    }
  };

  useEffect(() => {
    void loadVotes();
    void loadVoteGames();
  }, []);

  const voteStats = useMemo(() => {
    const stats = new Map<string, number>();
    votes.forEach((vote) => {
      const key = vote.game_name.trim();
      stats.set(key, (stats.get(key) ?? 0) + 1);
    });

    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1]);
  }, [votes]);

  const personalVoteSummaries = useMemo(() => {
    const summaryMap = new Map<
      string,
      {
        games: Set<string>;
        dates: Set<string>;
        times: Set<string>;
        recordCount: number;
      }
    >();

    votes.forEach((vote) => {
      const voterKey = vote.voter_name.trim() || "未命名";
      if (!summaryMap.has(voterKey)) {
        summaryMap.set(voterKey, {
          games: new Set<string>(),
          dates: new Set<string>(),
          times: new Set<string>(),
          recordCount: 0,
        });
      }

      const target = summaryMap.get(voterKey)!;
      target.recordCount += 1;
      if (vote.game_name.trim()) {
        target.games.add(vote.game_name.trim());
      }

      parseVoteDates(vote).forEach((date) => target.dates.add(date));

      const createdAt = new Date(vote.created_at);
      if (!Number.isNaN(createdAt.getTime())) {
        const timeText = createdAt.toLocaleString("zh-TW", {
          hour12: false,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        target.times.add(timeText);
      }
    });

    return Array.from(summaryMap.entries())
      .map(([voterName, info]) => ({
        voterName,
        games: Array.from(info.games),
        dates: Array.from(info.dates),
        times: Array.from(info.times),
        recordCount: info.recordCount,
      }))
      .sort((a, b) => a.voterName.localeCompare(b.voterName, "zh-Hant"));
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

  const onSaveCurrentVoteGames = async () => {
    const normalizedRows = gameRows
      .map((row) => ({
        id: row.id,
        gameName: row.gameName.trim(),
        gameUrl: row.gameUrl.trim(),
        gamePrice: row.gamePrice.trim(),
      }))
      .filter((row) => row.gameName || row.gameUrl || row.gamePrice);

    if (!normalizedRows.length) {
      setSuccessMessage("");
      setError("請至少填寫一款遊戲後再儲存");
      return;
    }

    if (normalizedRows.some((row) => !row.gameName)) {
      setSuccessMessage("");
      setError("每一列都需要填寫遊戲名稱");
      return;
    }

    const invalidUrlRow = normalizedRows.find((row) => {
      if (!row.gameUrl) return false;
      try {
        new URL(row.gameUrl);
        return false;
      } catch {
        return true;
      }
    });
    if (invalidUrlRow) {
      const rowIndex = normalizedRows.findIndex((row) => row.id === invalidUrlRow.id) + 1;
      setSuccessMessage("");
      setError(`第 ${rowIndex} 列遊戲網址格式不正確`);
      return;
    }

    try {
      const response = await fetch("/api/vote-room-games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          games: normalizedRows.map((row) => ({
            gameName: row.gameName,
            gameUrl: row.gameUrl,
            gamePrice: row.gamePrice,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success || !Array.isArray(result?.data)) {
        throw new Error(result?.error || "儲存本次遊戲清單失敗");
      }

      const voteGames: VoteGameOption[] = result.data.map((item: any) => ({
        id: String(item.id),
        gameName: typeof item?.game_name === "string" ? item.game_name : "",
        gameUrl: typeof item?.game_url === "string" ? item.game_url : "",
        gamePrice: typeof item?.game_price === "string" ? item.game_price : "",
      }));

      setCurrentVoteGames(voteGames);
      setSelectedGameIds((prev) => prev.filter((id) => voteGames.some((item) => item.id === id)));
      setGameRows(
        voteGames.map((game) => ({
          id: game.id,
          gameName: game.gameName,
          gameUrl: game.gameUrl,
          gamePrice: game.gamePrice,
        }))
      );
      setError("");
      setSuccessMessage(`已儲存本次遊戲清單（共 ${voteGames.length} 款）`);
    } catch (e: any) {
      setSuccessMessage("");
      setError(e?.message || "儲存本次遊戲清單失敗");
    }
  };

  const onToggleVoteGame = (gameId: string) => {
    if (gameId === ALL_GAMES_OPTION_ID) {
      setSelectedGameIds((prev) => {
        if (prev.includes(ALL_GAMES_OPTION_ID)) {
          return [];
        }
        return [ALL_GAMES_OPTION_ID, ...currentVoteGames.map((game) => game.id)];
      });
      return;
    }

    setSelectedGameIds((prev) => {
      const hasTarget = prev.includes(gameId);
      const next = hasTarget ? prev.filter((id) => id !== gameId) : [...prev, gameId];
      const selectedWithoutAll = next.filter((id) => id !== ALL_GAMES_OPTION_ID);
      const isAllSelected =
        currentVoteGames.length > 0 &&
        currentVoteGames.every((game) => selectedWithoutAll.includes(game.id));

      if (isAllSelected) {
        return [ALL_GAMES_OPTION_ID, ...selectedWithoutAll];
      }

      return selectedWithoutAll;
    });
  };

  const onDeleteVoteGame = async (gameId: string) => {
    try {
      const response = await fetch(`/api/vote-room-games?id=${gameId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "刪除遊戲失敗");
      }

      setCurrentVoteGames((prev) => prev.filter((item) => item.id !== gameId));
      setSelectedGameIds((prev) => prev.filter((id) => id !== gameId));
      setGameRows((prev) => {
        const next = prev.filter((row) => row.id !== gameId);
        return next.length > 0 ? next : [createEmptyGameRow()];
      });
      setError("");
      setSuccessMessage("已刪除遊戲");
    } catch (e: any) {
      setSuccessMessage("");
      setError(e?.message || "刪除遊戲失敗");
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage("");

    const trimmedVoterName = voterName.trim();
    const normalizedVoteDates = voteDates
      .map((date) => date.trim())
      .filter((date) => date.length > 0);

    if (!trimmedVoterName) {
      setError("請填寫姓名");
      return;
    }

    if (!currentVoteGames.length) {
      setError("請先在遊戲資訊表格填寫並儲存本次遊戲清單");
      return;
    }

    if (!selectedGameIds.length) {
      setError("請在遊戲投票區勾選當次要投票的遊戲");
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

    const isAllSelected = selectedGameIds.includes(ALL_GAMES_OPTION_ID);
    const selectedIds = selectedGameIds.filter((id) => id !== ALL_GAMES_OPTION_ID);
    const submitRows = isAllSelected
      ? currentVoteGames
      : currentVoteGames.filter((game) => selectedIds.includes(game.id));
    if (!submitRows.length) {
      setError("勾選的遊戲已失效，請重新勾選");
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

      setSelectedGameIds([]);
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
    setSuccessMessage("");
    setIsResetting(true);
    try {
      const response = await fetch("/api/vote-room", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "重新投票失敗");
      }

      setVotes([]);
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
    setSuccessMessage("");
    setEditingVoteId(vote.id);
    setEditingGameName(vote.game_name);
    setEditingGameUrl(typeof vote.game_url === "string" ? vote.game_url : "");
    setEditingGamePrice(
      typeof vote.game_price === "string"
        ? vote.game_price
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

    setError("");
    setSuccessMessage("");
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
              <div style={{ display: "flex", gap: 8 }}>
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
                <button
                  type="button"
                  onClick={onSaveCurrentVoteGames}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: "#1565c0",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  儲存本次遊戲清單
                </button>
              </div>
            </div>
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
                        placeholder="例如：4人約1580、每人400、包場價等"
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

          <div style={{ display: "grid", gap: 8 }}>
            <span>遊戲投票區</span>
            {currentVoteGames.length === 0 ? (
              <p style={{ margin: 0, color: "#777" }}>請先在上方表格填寫並儲存本次遊戲清單</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
                <li style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedGameIds.includes(ALL_GAMES_OPTION_ID)}
                      onChange={() => onToggleVoteGame(ALL_GAMES_OPTION_ID)}
                    />
                    <span>以上皆可</span>
                  </label>
                </li>
                {currentVoteGames.map((option) => (
                  <li key={option.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedGameIds.includes(option.id)}
                        onChange={() => onToggleVoteGame(option.id)}
                      />
                      <span>{option.gameName}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void onDeleteVoteGame(option.id)}
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
          {successMessage && <p style={{ margin: 0, color: "#2f7d32" }}>{successMessage}</p>}

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

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 10px" }}>個人投票彙整</h2>
          {personalVoteSummaries.length === 0 ? (
            <p style={{ margin: 0, color: "#777" }}>目前還沒有投票彙整</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
              {personalVoteSummaries.map((item) => (
                <li key={item.voterName}>
                  <strong>{item.voterName}</strong>
                  <div>想玩遊戲：{item.games.join("、") || "-"}</div>
                  <div>可投票日期：{item.dates.join("、") || "-"}</div>
                  <div>送出時間：{item.times.join("、") || "-"}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 style={{ margin: "0 0 10px" }}>投票紀錄</h2>
          {isLoading ? (
            <p style={{ margin: 0, color: "#777" }}>載入中...</p>
          ) : personalVoteSummaries.length === 0 ? (
            <p style={{ margin: 0, color: "#777" }}>目前沒有紀錄</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
              {personalVoteSummaries.map((item) => (
                <li key={item.voterName}>
                  <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10, background: "#fafafa" }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {item.voterName}（共 {item.recordCount} 筆）
                    </div>
                    <div>遊戲：{item.games.join("、") || "-"}</div>
                    <div>日期：{item.dates.join("、") || "-"}</div>
                    <div>投票時間：{item.times.join("、") || "-"}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
