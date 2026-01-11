// /register/page.tsx (使用 Supabase 版本 - 即時顯示所有報名者)

"use client";
import { useEffect, useState } from "react"; 
import styles from "./page.module.css";
import { useRouter } from "next/navigation";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase 設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
const supabase: SupabaseClient | null = hasSupabase 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
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

const registrationsRlsHint =
  "Supabase 權限/RLS 可能未設定完成：請在 Supabase SQL Editor 依序執行 db/create_registrations_table.sql、db/create_event_dates_table.sql、db/rls_registrations.sql（或直接跑 db/setup_registrations_complete.sql）。\n" +
  "若你有自己手動開 RLS，務必包含 GRANT（含 registrations_id_seq / event_dates_id_seq 的 sequence 權限），否則會出現 permission denied。";

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
  
  const initialFormInput = loadFormInput();
  const [formData, setFormData] = useState<FormData>({ 
    name: initialFormInput.name, 
    department: initialFormInput.department, 
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
  const [hasEventDatesTable, setHasEventDatesTable] = useState<boolean>(true);
  
  // 新增：所有報名者列表
  const [allRegistrations, setAllRegistrations] = useState<RegistrationItem[]>([]);

  const ensureRegistrationsTable = async (): Promise<string> => {
    if (!supabase) throw new Error("Supabase client 未初始化");
    if (registrationsTable) return registrationsTable;

    const candidates = ["registrations", "register"];
    for (const tableName of candidates) {
      const { error } = await supabase.from(tableName).select("id").limit(1);
      if (!error) {
        setRegistrationsTable(tableName);
        return tableName;
      }

      // 表可能存在，但被權限/RLS 擋住；這種情況要直接提示，而不是誤判成「找不到表」。
      if (isLikelySupabasePermissionError(error)) {
        throw new Error(
          `可以連到 Supabase，但資料表 public.${tableName} 被權限/RLS 擋住，導致無法讀取/寫入。\n` +
            registrationsRlsHint +
            `\n（原始錯誤：${(error as any)?.message || String(error)}）`
        );
      }
    }

    throw new Error("找不到報名資料表：請建立 public.registrations（建議）或 public.register");
  };

  const ensureEventDatesTable = async (): Promise<boolean> => {
    if (!supabase) return false;
    // 若已判定不存在，就不再查
    if (!hasEventDatesTable) return false;

    const { error } = await supabase.from("event_dates").select("id").limit(1);
    if (error) {
      setHasEventDatesTable(false);
      return false;
    }
    return true;
  };

  // === Supabase 資料載入函數 ===
  const loadFromSupabase = async () => {
    if (!supabase) return;

    try {
      // 載入活動日期（若 event_dates 不存在，使用預設卡片但不阻擋報名功能）
      const eventDatesOk = await ensureEventDatesTable();
      if (eventDatesOk) {
        const { data: datesData, error: datesError } = await supabase
          .from('event_dates')
          .select('*')
          .order('display_order', { ascending: true });

        if (datesError) throw datesError;

        if (datesData && datesData.length > 0) {
          const loadedCards = datesData.map(d => ({
            date: normalizeServerDateKey(d.event_date),
            image: d.image_url || '/game_16.png'
          }));
          setCards(loadedCards);
        } else {
          setCards(defaultDateCards);
        }
      } else {
        setCards(defaultDateCards);
      }

      // 載入報名資料
      const regsTable = await ensureRegistrationsTable();
      const { data: regsData, error: regsError } = await supabase
        .from(regsTable)
        .select('*')
        .order('created_at', { ascending: true });

      if (regsError) throw regsError;

      if (regsData) {
        const details: Record<string, RegisteredDetail> = {};
        const registrations: RegistrationItem[] = regsData.map((reg: any) => ({
          id: Number(reg.id),
          name: String(reg.name || ""),
          department: String(reg.department || ""),
          event_date: String(reg.event_date || ""),
          created_at: String(reg.created_at || ""),
        }));

        // 保留舊的每日期摘要（只取該日期最後一筆，供舊 UI/狀態使用）
        registrations.forEach((reg) => {
          const dateKey = normalizeServerDateKey(reg.event_date);
          if (!dateKey) return;
          details[dateKey] = { id: reg.id, name: reg.name, department: reg.department };
        });
        setRegisteredDetails(details);
        
        // 新增：設定所有報名者列表
        setAllRegistrations(registrations);
      }

      console.log("✅ 從 Supabase 載入資料成功");
    } catch (error) {
      console.error("❌ 從 Supabase 載入失敗:", error);
      setLoadError(formatErrorMessage(error));
      // 不再 fallback 到本地註冊資料，以避免造成資料不一致
      setRegisteredDetails({});
      setAllRegistrations([]);
    }
  };

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

  // === 初始化：決定使用 Supabase 或 Fallback ===
  useEffect(() => {
    const initialize = async () => {
      if (hasSupabase && supabase) {
        setUseSupabase(true);
        try {
          // 提前解析表名，避免後續行為因表名不一致而失敗
          await ensureRegistrationsTable();
          await ensureEventDatesTable();
          await loadFromSupabase();
        } catch (err) {
          console.error("Supabase 初始化載入失敗:", err);
          setLoadError(formatErrorMessage(err));
        }
      } else {
        setUseSupabase(false);
        console.warn(
          "Supabase 未設定或無效，改用 fallback /api/sheet。若要啟用即時同步與管理功能，請設定 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
        );
        setLoadError("Supabase 未設定，已改用 /api/sheet（Google 試算表）作為回退來源。");
        await loadFromFallback();
      }

      setIsClient(true);
    };

    initialize();
  }, []);

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
  }, [useSupabase, registrationsTable, hasEventDatesTable]);

  // === 表單輸入持久化 ===
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FORM_INPUT_KEY, JSON.stringify({ 
        name: formData.name, 
        department: formData.department 
      }));
    }
  }, [formData.name, formData.department]);

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
          alert("尚未建立 event_dates 資料表，無法編輯日期。請先在 Supabase 建立 event_dates。 ");
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
            const regsTable = await ensureRegistrationsTable();
            await supabase
              .from(regsTable)
              .update({ event_date: normalized })
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
    if (!editingRegistrationId) return;

    if (useSupabase && supabase) {
      try {
        const regsTable = await ensureRegistrationsTable();
        const { error } = await supabase
          .from(regsTable)
          .update({
            name: tempRegistrationData.name,
            department: tempRegistrationData.department,
          })
          .eq('id', editingRegistrationId);

        if (error) throw error;
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
        const { error } = await supabase
          .from(regsTable)
          .delete()
          .eq('id', regId);

        if (error) throw error;
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
        const regsTable = await ensureRegistrationsTable();
        const { error } = await supabase
          .from(regsTable)
          .insert({
            name: formData.name,
            department: formData.department,
            event_date: formData.date
          });

        if (error) {
          if (isLikelySupabasePermissionError(error)) {
            throw new Error(registrationsRlsHint + `\n（原始錯誤：${(error as any)?.message || String(error)}）`);
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
        {/* 資料來源指示器 */}
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
          {hasSupabase ? (useSupabase ? '🟢 Supabase' : '🟠 Supabase (初始化中)') : '🟣 Fallback /api/sheet'}
        </div>
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
                {!isEditingDates && dateRegistrations.length === 0 && (
                  <div className={styles.emptyRegistrationSpace}>
                    <p className={styles.emptyText}>按下報名</p>
                  </div>
                )}
                
                {/* 該日期的報名者列表 */}
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

                <div className={styles.cardBottomArea}>
                  <div className={styles.cardBottomDivider} />
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
            onClick={() => setIsEditingDates(prev => !prev)}
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
