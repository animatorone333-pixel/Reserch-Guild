// /register/page.tsx (使用 Supabase 版本 - 即時顯示所有報名者)

"use client";
import { useEffect, useState } from "react"; 
import styles from "./page.module.css";
import { useRouter } from "next/navigation";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase 設定
const ENV_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ENV_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const initialHasSupabase = ENV_SUPABASE_URL !== "" && ENV_SUPABASE_ANON_KEY !== "";
const initialSupabase: SupabaseClient | null = initialHasSupabase
  ? createClient(ENV_SUPABASE_URL, ENV_SUPABASE_ANON_KEY)
  : null;

// Fallback API（當沒有 Supabase 時使用）
const SHEET_API_URL = "/api/sheet";
const DATE_STORAGE_KEY = "register_page_dates_v3"; 
const REGISTRATION_DETAILS_KEY = "registration_details_v1"; 
const FORM_INPUT_KEY = "form_input_v1";

// 資料結構
interface FormData {
  name: string;
  department: string;
  date: string;
}

interface CardData {
  date: string;
  image: string;
}

interface RegisteredDetail {
  id?: number;
  name: string;
  department: string;
}

// 新增：報名者列表項目
interface RegistrationItem {
  id: number;
  name: string;
  department: string;
  event_date: string;
  created_at: string;
}

const isLikelySupabasePermissionError = (err: unknown) => {
  const msg = (err && typeof err === "object" && "message" in err)
    ? String((err as any).message || "")
    : String(err || "");
  const m = msg.toLowerCase();
  return (
    m.includes("permission denied") ||
    m.includes("row-level security") ||
    m.includes("row level security") ||
    m.includes("violates row-level security") ||
    m.includes("violates row level security") ||
    m.includes("not allowed") ||
    m.includes("insufficient_privilege")
  );
};

const formatErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;

  if (err && typeof err === "object") {
    const anyErr: any = err;
    const parts: string[] = [];
    if (anyErr.message) parts.push(String(anyErr.message));
    if (anyErr.details) parts.push(String(anyErr.details));
    if (anyErr.hint) parts.push(String(anyErr.hint));
    if (anyErr.code) parts.push(`code=${String(anyErr.code)}`);
    if (parts.length > 0) return parts.join(" | ");
  }

  return String(err);
};

const isLikelySupabaseAuthOrConfigError = (err: unknown) => {
  const msg = (err && typeof err === "object" && "message" in err)
    ? String((err as any).message || "")
    : String(err || "");
  const m = msg.toLowerCase();
  return (
    m.includes("invalid api key") ||
    m.includes("no api key") ||
    m.includes("jwt") ||
    m.includes("unauthorized") ||
    m.includes("forbidden") ||
    m.includes("not authorized")
  );
};

const isLikelyMissingTableError = (err: unknown) => {
  const msg = (err && typeof err === "object" && "message" in err)
    ? String((err as any).message || "")
    : String(err || "");
  const m = msg.toLowerCase();
  return (
    m.includes("could not find") ||
    m.includes("does not exist") ||
    m.includes("relation") ||
    m.includes("schema cache")
  );
};

const registrationsRlsHint =
  "Supabase 權限/RLS 可能未設定完成：請在 Supabase SQL Editor 依序執行 db/create_registrations_table.sql、db/create_event_dates_table.sql、db/rls_registrations.sql（或直接跑 db/setup_registrations_complete.sql）。\n" +
  "若你使用 legacy public.register 表，請改執行 db/rls_register.sql（會同時處理 register + event_dates 的 RLS/GRANT）。\n" +
  "若你有自己手動開 RLS，務必包含 GRANT（含 registrations_id_seq / event_dates_id_seq（或 register_id_seq） 的 sequence 權限），否則會出現 permission denied。";

// 預設日期卡片（每月前三個星期一）
const defaultDateCards: CardData[] = [
  { date: "1/5", image: "/game_16.png" },
  { date: "1/12", image: "/game_17.png" },
  { date: "1/19", image: "/game_18.png" },
];

// 日期格式化函數
const normalizeServerDateKey = (raw: any) => {
  if (!raw) return "";
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (m) {
    const month = String(Number(m[1]));
    const day = String(Number(m[2]));
    return `${month}/${day}`;
  }
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}/${day}`;
  }
  return s;
};

// localStorage 讀取函數（作為 fallback）
const loadCards = (): CardData[] => {
  if (typeof window === 'undefined') return defaultDateCards;
  const storedJson = localStorage.getItem(DATE_STORAGE_KEY);
  if (storedJson) {
    try {
      const parsedDates: string[] = JSON.parse(storedJson);
      return defaultDateCards.map((defaultCard, i) => ({
        ...defaultCard,
        date: normalizeServerDateKey(parsedDates[i] || defaultCard.date), 
      }));
    } catch (e) {
      console.error("Failed to parse stored dates:", e);
      localStorage.removeItem(DATE_STORAGE_KEY); 
    }
  }
  return defaultDateCards;
};

const loadRegistrationDetails = (): Record<string, RegisteredDetail> => {
  if (typeof window === 'undefined') return {};
  const storedJson = localStorage.getItem(REGISTRATION_DETAILS_KEY);
  if (storedJson) {
    try {
      return JSON.parse(storedJson);
    } catch (e) {
      console.error("Failed to parse stored registration details:", e);
    }
  }
  return {};
};

const loadFormInput = (): { name: string; department: string } => {
  if (typeof window === 'undefined') return { name: "", department: "" };
  const storedJson = localStorage.getItem(FORM_INPUT_KEY);
  if (storedJson) {
    try {
      return JSON.parse(storedJson);
    } catch (e) {
      console.error("Failed to parse stored form input:", e);
    }
  }
  return { name: "", department: "" };
};

export default function RegisterPage() {
  const router = useRouter();

  const [hasSupabase, setHasSupabase] = useState(initialHasSupabase);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(initialSupabase);
  
  const [formData, setFormData] = useState<FormData>({ 
    name: "", 
    department: "", 
    date: "" 
  }); 

  const [cards, setCards] = useState<CardData[]>(defaultDateCards); 
  const [registeredDetails, setRegisteredDetails] = useState<Record<string, RegisteredDetail>>({});
  const [loadedIndexes, setLoadedIndexes] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false); 
  const [editingRegistrationId, setEditingRegistrationId] = useState<number | null>(null);
  const [tempRegistrationData, setTempRegistrationData] = useState<{ name: string; department: string }>({ name: "", department: "" });
  const [isClient, setIsClient] = useState(false);
  const [useSupabase, setUseSupabase] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registrationsTable, setRegistrationsTable] = useState<string | null>(null);
  const [registrationsEventDateColumn, setRegistrationsEventDateColumn] = useState<"event_date" | "date">("event_date");
  const [hasEventDatesTable, setHasEventDatesTable] = useState<boolean>(true);

  const [initializedData, setInitializedData] = useState(false);

  // 右上角資料來源提示（debug 用）：預設隱藏
  const [showDataSourceIndicator, setShowDataSourceIndicator] = useState(false);
  
  // 新增：所有報名者列表
  const [allRegistrations, setAllRegistrations] = useState<RegistrationItem[]>([]);

  // 若 build-time NEXT_PUBLIC_* 沒被內嵌（例如 Vercel 環境變數後加、未觸發重建），
  // 這裡會從 server runtime 取得設定並初始化 Supabase。
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const debugParam = (params.get("debug") || "").toLowerCase();
    const enabledByQuery = params.has("debug") || ["1", "true", "on", "yes"].includes(debugParam);
    const enabledByStorage = localStorage.getItem("mygame_debug_ui") === "1";
    setShowDataSourceIndicator(enabledByQuery || enabledByStorage);
  }, []);

  type RegistrationsTarget = { table: string; eventCol: "event_date" | "date" };

  const ensureRegistrationsTarget = async (): Promise<RegistrationsTarget> => {
    if (!supabase) throw new Error("Supabase client 未初始化");

    // 若已選定資料表，仍重新確認欄位（避免 setState 非同步導致的 race）
    if (registrationsTable) {
      const tableName = registrationsTable;

      const { error: eventDateError } = await supabase.from(tableName).select("event_date").limit(1);
      if (!eventDateError) {
        if (registrationsEventDateColumn !== "event_date") setRegistrationsEventDateColumn("event_date");
        return { table: tableName, eventCol: "event_date" };
      }

      const { error: dateError } = await supabase.from(tableName).select("date").limit(1);
      if (!dateError) {
        if (registrationsEventDateColumn !== "date") setRegistrationsEventDateColumn("date");
        return { table: tableName, eventCol: "date" };
      }

      throw new Error(
        `資料表 public.${tableName} 找不到 event_date 或 date 欄位。\n` +
          "請在 Supabase SQL Editor 執行 db/setup_registrations_complete.sql，或確認你現有資料表欄位名稱。"
      );
    }

    const candidates = ["registrations", "register"];
    let lastError: unknown = null;
    for (const tableName of candidates) {
      // 先確認表存在且可讀
      const { error: idError } = await supabase.from(tableName).select("id").limit(1);
      if (idError) {
        lastError = idError;

        if (isLikelySupabaseAuthOrConfigError(idError)) {
          throw new Error(
            "Supabase 連線/授權失敗：請確認 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 是否正確，且指向同一個 Supabase 專案。" +
              `\n（原始錯誤：${formatErrorMessage(idError)}）`
          );
        }

        // 表可能存在，但被權限/RLS 擋住；這種情況要直接提示，而不是誤判成「找不到表」。
        if (isLikelySupabasePermissionError(idError)) {
          throw new Error(
            `可以連到 Supabase，但資料表 public.${tableName} 被權限/RLS 擋住，導致無法讀取/寫入。\n` +
              registrationsRlsHint +
              `\n（原始錯誤：${formatErrorMessage(idError)}）`
          );
        }

        continue;
      }

      // 再確認事件日期欄位是哪一個（避免 legacy register 表只有 date、沒有 event_date）
      const { error: eventDateError } = await supabase.from(tableName).select("event_date").limit(1);
      if (!eventDateError) {
        setRegistrationsTable(tableName);
        setRegistrationsEventDateColumn("event_date");
        return { table: tableName, eventCol: "event_date" };
      }

      const { error: dateError } = await supabase.from(tableName).select("date").limit(1);
      if (!dateError) {
        setRegistrationsTable(tableName);
        setRegistrationsEventDateColumn("date");
        return { table: tableName, eventCol: "date" };
      }

      lastError = eventDateError || dateError;
    }

    const extra = lastError ? `\n（最後一次錯誤：${formatErrorMessage(lastError)}）` : "";
    throw new Error(
      "找不到報名資料表：請建立 public.registrations（建議）或 public.register。\n" +
        "建議直接在 Supabase SQL Editor 執行 db/setup_registrations_complete.sql。" +
        extra
    );
  };

  const ensureRegistrationsTable = async (): Promise<string> => {
    const target = await ensureRegistrationsTarget();
    return target.table;
  };

  const ensureEventDatesTable = async (): Promise<boolean> => {
    if (!supabase) return false;
    // 若已判定不存在，就不再查
    if (!hasEventDatesTable) return false;

    const { error } = await supabase.from("event_dates").select("id").limit(1);
    if (error) {
      if (isLikelySupabaseAuthOrConfigError(error)) {
        throw new Error(
          "Supabase 連線/授權失敗：請確認 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 是否正確。" +
            `\n（原始錯誤：${formatErrorMessage(error)}）`
        );
      }

      if (isLikelySupabasePermissionError(error)) {
        throw new Error(
          "可以連到 Supabase，但 public.event_dates 讀取被權限/RLS 擋住。\n" +
            registrationsRlsHint +
            `\n（原始錯誤：${formatErrorMessage(error)}）`
        );
      }

      setHasEventDatesTable(false);
      return false;
    }
    return true;
  };

  const checkEventDatesTable = async (): Promise<boolean> => {
    const exists = await ensureEventDatesTable();
    setHasEventDatesTable(exists);
    return exists;
  };

  // === 從 Supabase 載入（日期卡片 + 報名資料） ===
  const loadFromSupabase = async () => {
    if (!supabase) return;

    try {
      // 先載入日期卡片（若有 event_dates）
      let nextCards: CardData[] = defaultDateCards;
      const hasDates = await ensureEventDatesTable();
      setHasEventDatesTable(hasDates);

      if (hasDates) {
        const { data: dates, error: datesError } = await supabase
          .from("event_dates")
          .select("event_date, image_url, display_order")
          .order("display_order", { ascending: true });

        if (datesError) throw datesError;
        if (Array.isArray(dates) && dates.length > 0) {
          const merged = dates
            .slice(0, defaultDateCards.length)
            .map((d: any, idx: number) => ({
              date: normalizeServerDateKey(d.event_date),
              image: String(d.image_url || defaultDateCards[idx]?.image || "/game_16.png"),
            }));

          // 若資料筆數不足，補齊預設卡片
          if (merged.length < defaultDateCards.length) {
            for (let i = merged.length; i < defaultDateCards.length; i++) {
              merged.push({ ...defaultDateCards[i] });
            }
          }
          nextCards = merged;
        }
      }
      setCards(nextCards);

      // 載入所有報名資料
      const { table: regsTable, eventCol } = await ensureRegistrationsTarget();
      const { data: regsData, error: regsError } = await supabase
        .from(regsTable)
        .select(`id, name, department, ${eventCol}, created_at`)
        .order("created_at", { ascending: true });

      if (regsError) throw regsError;

      const registrations: RegistrationItem[] = Array.isArray(regsData)
        ? regsData.map((r: any) => ({
            id: Number(r.id),
            name: String(r.name || ""),
            department: String(r.department || ""),
            event_date: String(r[eventCol] || ""),
            created_at: String(r.created_at || ""),
          }))
        : [];

      // 維持既有 registeredDetails（單日顯示用）
      const detailsMap: Record<string, RegisteredDetail> = {};
      registrations.forEach((r) => {
        const key = normalizeServerDateKey(r.event_date);
        if (!key) return;
        detailsMap[key] = {
          id: r.id,
          name: r.name,
          department: r.department,
        };
      });

      setRegisteredDetails(detailsMap);
      setAllRegistrations(registrations);

      console.log("✅ 從 Supabase 載入資料成功");
    } catch (error) {
      console.error("❌ 從 Supabase 載入失敗:", error);
      setLoadError(formatErrorMessage(error));
      // 不再 fallback 到本地註冊資料，以避免造成資料不一致
      setRegisteredDetails({});
      setAllRegistrations([]);
    }
  };

  // === 初始化：決定使用 Supabase 或 Fallback ===
  useEffect(() => {
    const init = async () => {
      if (initializedData) return;

      setIsClient(true);

      // 等待 runtime config（若需要）
      if (hasSupabase && !supabase) return;

      if (hasSupabase && supabase) {
        try {
          setUseSupabase(true);
          setLoadError(null);
          await ensureRegistrationsTarget();
          await checkEventDatesTable();
          await loadFromSupabase();
          setInitializedData(true);
        } catch (e) {
          setUseSupabase(false);

          const msg = formatErrorMessage(e);
          if (isLikelySupabasePermissionError(e)) {
            setLoadError(
              "Supabase 權限不足（RLS/GRANT）導致無法讀取資料，已改用 fallback /api/sheet。\n\n" +
                registrationsRlsHint +
                "\n\n原始錯誤：" +
                msg
            );
          } else if (isLikelyMissingTableError(e)) {
            setLoadError(
              "Supabase 資料表不存在或 schema cache 尚未更新，已改用 fallback /api/sheet。\n\n" +
                "請確認已執行 db/setup_registrations_complete.sql，並在 Supabase Dashboard → Database → Replication 開啟 event_dates / registrations Realtime。\n\n" +
                "原始錯誤：" +
                msg
            );
          } else if (isLikelySupabaseAuthOrConfigError(e)) {
            setLoadError(
              "Supabase 連線/授權失敗：請確認 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 是否正確，且指向同一個 Supabase 專案。" +
                "\n\n原始錯誤：" +
                msg
            );
          } else {
            setLoadError(
              "Supabase 載入失敗，已改用 fallback /api/sheet。\n\n" +
                "原始錯誤：" +
                msg
            );
          }

          await loadFromFallback();
          setInitializedData(true);
        }
      } else {
        setUseSupabase(false);
        setLoadError(
          "Supabase 未設定或無效，改用 fallback /api/sheet。若要啟用即時同步與管理功能，請設定 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
        );
        await loadFromFallback();
        setInitializedData(true);
      }
    };
    init();
  }, [hasSupabase, supabase, initializedData, registrationsTable]);

  // === Fallback: 從 API/localStorage 載入 ===
  const loadFromFallback = async () => {
    setCards(loadCards());
    const local = loadRegistrationDetails();

    try {
      const res = await fetch(SHEET_API_URL, { cache: "no-store" });
      if (!res.ok) {
        setRegisteredDetails(local);
        setAllRegistrations([]);
        return;
      }

      const data = await res.json();
      const parsed: Record<string, RegisteredDetail> = {};
      const items = Array.isArray(data) ? data : Array.isArray((data as any).data) ? (data as any).data : [];

      const fallbackRegistrations: RegistrationItem[] = [];

      items.forEach((item: any) => {
        if (!item) return;
        if (typeof item === "object" && !Array.isArray(item)) {
          const rawDate = item.date || item.Date || item["日期"] || item[0];
          const name = item.name || item.Name || item["姓名"] || item[1] || "";
          const department = item.department || item.Department || item["部門"] || item[2] || "";
          const createdAt =
            item.created_at ||
            item.createdAt ||
            item.timestamp ||
            item.time ||
            item["時間"] ||
            new Date().toISOString();
          const idCandidate = item.id ?? item["id"] ?? item["編號"];

          const dateKey = normalizeServerDateKey(rawDate);
          if (dateKey) parsed[dateKey] = { name: String(name || "").trim(), department: String(department || "").trim() };

          fallbackRegistrations.push({
            id:
              typeof idCandidate === "number"
                ? idCandidate
                : typeof idCandidate === "string" && !Number.isNaN(Number(idCandidate))
                  ? Number(idCandidate)
                  : Date.now() + fallbackRegistrations.length,
            name: String(name || "").trim(),
            department: String(department || "").trim(),
            event_date: dateKey,
            created_at: String(createdAt || ""),
          });
          return;
        }
        if (Array.isArray(item)) {
          const [rawDate, name, department] = item;
          const dateKey = normalizeServerDateKey(rawDate);
          if (dateKey) parsed[dateKey] = { name: String(name || "").trim(), department: String(department || "").trim() };

          fallbackRegistrations.push({
            id: Date.now() + fallbackRegistrations.length,
            name: String(name || "").trim(),
            department: String(department || "").trim(),
            event_date: dateKey,
            created_at: new Date().toISOString(),
          });
        }
      });

      const final = { ...local, ...parsed };
      setRegisteredDetails(final);
      setAllRegistrations(fallbackRegistrations);
    } catch (e) {
      console.error("Fallback 載入失敗:", e);
      setRegisteredDetails(local);
      setAllRegistrations([]);
    }
  };

  // === Supabase Realtime 訂閱 ===
  useEffect(() => {
    if (!useSupabase || !supabase) return;
    if (!registrationsTable) return;

    // 訂閱報名資料變更
    const regsChannel = supabase
      .channel('public:registrations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: registrationsTable },
        (payload) => {
          console.log('📡 Registrations 變更:', payload);
          loadFromSupabase(); // 重新載入資料
        }
      )
      .subscribe();

    // 訂閱活動日期變更
    const datesChannel = hasEventDatesTable
      ? supabase
          .channel('public:event_dates')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'event_dates' },
            (payload) => {
              console.log('📡 Event dates 變更:', payload);
              loadFromSupabase(); // 重新載入資料
            }
          )
          .subscribe()
      : null;

    return () => {
      supabase.removeChannel(regsChannel);
      if (datesChannel) supabase.removeChannel(datesChannel);
    };
  }, [useSupabase, supabase, registrationsTable, hasEventDatesTable]);

  // === 清除舊的表單預設值（不再記憶姓名/部門） ===
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FORM_INPUT_KEY);
    }
  }, []);

  // === localStorage 持久化（作為 fallback） ===
  useEffect(() => {
    if (typeof window !== 'undefined' && isClient && !useSupabase) {
      const datesToPersist = cards.map(card => card.date);
      localStorage.setItem(DATE_STORAGE_KEY, JSON.stringify(datesToPersist));
    }
  }, [cards, isClient, useSupabase]);

  useEffect(() => {
    if (typeof window !== 'undefined' && isClient && !useSupabase) {
      localStorage.setItem(REGISTRATION_DETAILS_KEY, JSON.stringify(registeredDetails));
    }
  }, [registeredDetails, isClient, useSupabase]);

  // === 動畫效果 ===
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    cards.forEach((_, i) => {
      const timer = setTimeout(() => {
        setLoadedIndexes(prev => [...prev, i]);
      }, 500 + i * 150);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [cards]); 

  // === 事件處理函數 ===
  
  const handleDateChange = async (index: number, newDate: string) => {
    const oldDate = cards[index].date;
    const normalized = normalizeServerDateKey(newDate);

    if (useSupabase && supabase) {
      try {
        if (!hasEventDatesTable) {
          alert("尚未建立 event_dates 資料表，無法編輯日期。\n請先在 Supabase 執行 db/setup_registrations_complete.sql 建立資料表。");
          return;
        }
        // 在 Supabase 更新日期
        const { error } = await supabase
          .from('event_dates')
          .upsert({ 
            event_date: normalized, 
            image_url: cards[index].image,
            display_order: index + 1
          }, { 
            onConflict: 'event_date' 
          });

        if (error) throw error;

        // 如果有報名資料，也要更新
        if (oldDate !== normalized && registeredDetails[oldDate]) {
          const detail = registeredDetails[oldDate];
          if (detail.id) {
            const { table: regsTable, eventCol } = await ensureRegistrationsTarget();
            await supabase
              .from(regsTable)
              .update({ [eventCol]: normalized })
              .eq('id', detail.id);
          }
        }
      } catch (error) {
        console.error("更新日期失敗:", error);
        alert("更新日期失敗，請稍後再試");
      }
    } else {
      // Fallback: 本地更新
      setCards(prevCards => 
        prevCards.map((card, i) => 
          i === index ? { ...card, date: normalized } : card
        )
      );
      
      if (oldDate !== normalized && registeredDetails[oldDate]) {
        setRegisteredDetails(prev => {
          const newDetails = { ...prev };
          newDetails[normalized] = newDetails[oldDate];
          delete newDetails[oldDate];
          return newDetails;
        });
      }
    }
  };
  
  const handleEditRegistration = (reg: RegistrationItem) => {
    setTempRegistrationData({ name: reg.name, department: reg.department });
    setEditingRegistrationId(reg.id);
  };

  const handleSaveRegistration = async () => {
    if (editingRegistrationId === null) return;

    if (useSupabase && supabase) {
      try {
        const regsTable = await ensureRegistrationsTable();
        const { data, error } = await supabase
          .from(regsTable)
          .update({
            name: tempRegistrationData.name,
            department: tempRegistrationData.department,
          })
          .eq('id', editingRegistrationId)
          .select('id');

        if (error) throw error;

        // PostgREST / RLS 可能導致「0 rows affected 但不報錯」；此時要提示使用者同步沒成功。
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error(
            `更新沒有套用到任何資料（table=${regsTable}, id=${editingRegistrationId}）。\n` +
              "常見原因：RLS 未允許 UPDATE、你目前使用的是 public.register 但沒套用 db/rls_register.sql、或該筆資料已不存在。\n\n" +
              registrationsRlsHint
          );
        }
        alert("儲存成功！");

        // Realtime 若未啟用，也能立即看到更新
        await loadFromSupabase();
      } catch (error) {
        console.error("儲存失敗:", error);
        alert(`儲存失敗：${formatErrorMessage(error)}`);
      }
    } else {
      throw new Error("Supabase 未設定，無法儲存修改。");
    }

    setEditingRegistrationId(null);
    setTempRegistrationData({ name: "", department: "" });
  };

  const handleCancelRegistration = () => {
    setEditingRegistrationId(null);
    setTempRegistrationData({ name: "", department: "" });
  };

  const handleDeleteRegistration = async (regId: number) => {
    if (!window.confirm("確定要刪除這筆報名資訊嗎？")) return;

    if (useSupabase && supabase) {
      try {
        const regsTable = await ensureRegistrationsTable();
        const { data, error } = await supabase
          .from(regsTable)
          .delete()
          .eq('id', regId)
          .select('id');

        if (error) throw error;

        // 同上：避免顯示成功但其實沒有刪到（RLS/表名/ID 不匹配都會發生）
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error(
            `刪除沒有影響任何資料（table=${regsTable}, id=${regId}）。\n` +
              "常見原因：RLS 未允許 DELETE、你目前使用的是 public.register 但沒套用 db/rls_register.sql、或該筆資料已不存在。\n\n" +
              registrationsRlsHint
          );
        }
        alert("刪除成功！");

        // Realtime 若未啟用，也能立即看到更新
        await loadFromSupabase();
      } catch (error) {
        console.error("刪除失敗:", error);
        alert(`刪除失敗：${formatErrorMessage(error)}`);
      }
    } else {
      throw new Error("Supabase 未設定，無法刪除。");
    }
  };

  const handleCardClick = (date: string) => {
    if (isEditingDates || editingRegistrationId) return; 
    setFormData(prev => ({ 
      name: prev.name, 
      department: prev.department,
      date: date 
    })); 
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (useSupabase && supabase) {
        // 使用 Supabase
        const { table: regsTable, eventCol } = await ensureRegistrationsTarget();
        const { error } = await supabase
          .from(regsTable)
          .insert({
            name: formData.name,
            department: formData.department,
            [eventCol]: formData.date
          });

        if (error) {
          if (isLikelySupabasePermissionError(error)) {
            throw new Error(registrationsRlsHint + `\n（原始錯誤：${formatErrorMessage(error)}）`);
          }
          if (isLikelySupabaseAuthOrConfigError(error)) {
            throw new Error(
              "Supabase 連線/授權失敗：請確認 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 是否正確，並確認 Vercel 已部署到最新 commit。" +
                `\n（原始錯誤：${formatErrorMessage(error)}）`
            );
          }
          if (isLikelyMissingTableError(error)) {
            throw new Error(
              "Supabase 資料表可能尚未建立，或 PostgREST schema cache 尚未更新。\n" +
                "請在 Supabase SQL Editor 執行 db/setup_registrations_complete.sql，執行完等 30~60 秒再重試。" +
                `\n（原始錯誤：${formatErrorMessage(error)}）`
            );
          }
          throw error;
        }
        
        alert("報名成功！");
        setShowForm(false);
        setFormData(prev => ({ name: prev.name, department: prev.department, date: "" }));

        // Realtime 若未啟用，也能立即看到新增
        await loadFromSupabase();
      } else {
        // Fallback: 走 /api/sheet（由 server route 代理到 Apps Script）
        const res = await fetch(SHEET_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: formData.date,
            name: formData.name,
            department: formData.department,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Fallback API 錯誤：${res.status} ${text}`);
        }

        alert("報名成功！");
        setShowForm(false);
        setFormData(prev => ({ name: prev.name, department: prev.department, date: "" }));
        await loadFromFallback();
      }
    } catch (error) {
      console.error("提交報名失敗:", error);
      alert(`報名失敗：${formatErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* 資料來源指示器（debug 用）：加 ?debug=1 才顯示 */}
        {showDataSourceIndicator && (
          <div style={{ 
            position: 'fixed', 
            top: '10px', 
            right: '10px', 
            background: hasSupabase ? (useSupabase ? '#4CAF50' : '#FF9800') : '#7E57C2',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 1000
          }}>
            <div>
              {hasSupabase ? (useSupabase ? '🟢 Supabase' : '🟠 Supabase (初始化中)') : '🟣 Fallback /api/sheet'}
            </div>
            <div style={{ marginTop: 4, opacity: 0.95, fontWeight: 600 }}>
              {useSupabase
                ? `表：${registrationsTable || '（偵測中）'}；日期欄：${registrationsEventDateColumn}`
                : '表：fallback'}
            </div>
          </div>
        )}
          {loadError && (
            <div style={{
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              top: '70px',
              background: '#fff3cd',
              color: '#856404',
              border: '1px solid #ffeeba',
              padding: '12px 18px',
              borderRadius: '8px',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}>
              <strong>注意：</strong> {loadError}
            </div>
          )}

          {cards.map((card, i) => {
            const isCurrentlyEditing = editingRegistrationId !== null;
            // 取得該日期的所有報名者
            const dateRegistrations = allRegistrations.filter(
              reg => normalizeServerDateKey(reg.event_date) === card.date
            );
            
            return (
              <div
                key={i}
                className={`${styles.card} ${loadedIndexes.includes(i) ? styles.animateIn : ""}`}
                style={{ backgroundImage: `url(${card.image})` }}
              >
                {/* 日期輸入/顯示部分 */}
                {isEditingDates ? (
                  <input
                    type="text"
                    value={card.date}
                    onChange={(e) => handleDateChange(i, e.target.value)}
                    className={styles.dateInput}
                    onClick={(e) => e.stopPropagation()} 
                  />
                ) : (
                  <div className={styles.dateOverlay}>{card.date}</div>
                )}
                
                {/* 空狀態提示 */}
                <div className={styles.cardBottomArea}>
                  {/* 空狀態提示（移到底部棕色區塊） */}
                  {!isEditingDates && dateRegistrations.length === 0 && (
                    <div className={styles.emptyRegistrationSpace}>
                      <p className={styles.emptyText}>按下報名</p>
                    </div>
                  )}

                  {/* 該日期的報名者列表（移到底部棕色區塊） */}
                  {dateRegistrations.length > 0 && (
                    <div className={styles.cardRegistrationsList} onClick={(e) => e.stopPropagation()}>
                      {dateRegistrations.map((reg, index) => {
                        const isEditingThis = editingRegistrationId === reg.id;
                        return (
                          <div key={reg.id} className={styles.cardRegistrationItem}>
                            <span className={styles.cardRegNumber}>{index + 1}.</span>
                            {isEditingThis ? (
                              <>
                                <input
                                  type="text"
                                  value={tempRegistrationData.name}
                                  onChange={(e) => setTempRegistrationData(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="姓名"
                                  className={styles.editInput}
                                />
                                <input
                                  type="text"
                                  value={tempRegistrationData.department}
                                  onChange={(e) => setTempRegistrationData(prev => ({ ...prev, department: e.target.value }))}
                                  placeholder="部門"
                                  className={styles.editInput}
                                />
                                <button onClick={(e) => { e.stopPropagation(); handleSaveRegistration(); }} className={styles.saveBtn}>儲存</button>
                                <button onClick={(e) => { e.stopPropagation(); handleCancelRegistration(); }} className={styles.cancelBtn}>取消</button>
                              </>
                            ) : (
                              <>
                                <span className={styles.cardRegName}>{reg.name}</span>
                                <span className={styles.cardRegDept}>({reg.department})</span>
                                <button onClick={(e) => { e.stopPropagation(); handleEditRegistration(reg); }} className={styles.actionBtn}>編輯</button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteRegistration(reg.id); }} className={styles.actionBtnDelete}>刪除</button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button 
                    className={styles.registerButton}
                    disabled={isEditingDates || editingRegistrationId !== null} 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(card.date);
                    }}
                  >
                    報名
                  </button>
                </div>
              </div>
            );
          })}
          
          {/* 日期編輯按鈕 */}
          <button 
            className={styles.editBtn} 
            onClick={() => {
              if (!isEditingDates && !hasEventDatesTable) {
                alert("尚未建立 event_dates 資料表，無法編輯日期。\n請在 Supabase 執行 db/setup_registrations_complete.sql 建立資料表。");
                return;
              }
              setIsEditingDates(prev => !prev);
            }}
            disabled={editingRegistrationId !== null}
          >
            {isEditingDates ? "完成編輯" : "編輯日期"}
          </button>
          
          <button className={styles.homeBtnCalendar} onClick={() => router.push("/")}>
            回首頁
          </button>

          {/* 報名表單 */}
          {showForm && (
            <div className={styles.modal}>
              <form className={styles.form} onSubmit={handleSubmit}>
                <h3>報名活動</h3>
                <div>
                  <label>部門：</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>姓名：</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>日期：</label>
                  <input type="text" value={formData.date} readOnly /> 
                </div>
                <div className={styles.buttonRow}>
                  <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "送出中..." : "送出"}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}>
                    取消
                  </button>
                </div>
              </form>
            </div>
          )}
      </div>
    </main>
  );
}
