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

// 預設日期卡片
const defaultDateCards: CardData[] = [
  { date: "10/13", image: "/game_16.png" },
  { date: "11/26", image: "/game_17.png" },
  { date: "12/10", image: "/game_18.png" },
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
  const [editingRegistrationDate, setEditingRegistrationDate] = useState<string | null>(null);
  const [tempRegistrationData, setTempRegistrationData] = useState<{ name: string; department: string }>({ name: "", department: "" });
  const [isClient, setIsClient] = useState(false);
  const [useSupabase, setUseSupabase] = useState(false);
  
  // 新增：所有報名者列表
  const [allRegistrations, setAllRegistrations] = useState<RegistrationItem[]>([]);

  // === Supabase 資料載入函數 ===
  const loadFromSupabase = async () => {
    if (!supabase) return;

    try {
      // 載入活動日期
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
      }

      // 載入報名資料
      const { data: regsData, error: regsError } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: true });

      if (regsError) throw regsError;

      if (regsData) {
        const details: Record<string, RegisteredDetail> = {};
        regsData.forEach(reg => {
          const dateKey = normalizeServerDateKey(reg.event_date);
          if (dateKey) {
            details[dateKey] = {
              id: reg.id,
              name: reg.name || "",
              department: reg.department || ""
            };
          }
        });
        setRegisteredDetails(details);
        
        // 新增：設定所有報名者列表
        setAllRegistrations(regsData);
      }

      console.log("✅ 從 Supabase 載入資料成功");
    } catch (error) {
      console.error("❌ 從 Supabase 載入失敗:", error);
      // Fallback 到 localStorage
      setCards(loadCards());
      setRegisteredDetails(loadRegistrationDetails());
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
        return;
      }

      const data = await res.json();
      const parsed: Record<string, RegisteredDetail> = {};
      const items = Array.isArray(data) ? data : Array.isArray((data as any).data) ? (data as any).data : [];

      items.forEach((item: any) => {
        if (!item) return;
        if (typeof item === "object" && !Array.isArray(item)) {
          const rawDate = item.date || item.Date || item["日期"] || item[0];
          const name = item.name || item.Name || item["姓名"] || item[1] || "";
          const department = item.department || item.Department || item["部門"] || item[2] || "";
          const dateKey = normalizeServerDateKey(rawDate);
          if (dateKey) parsed[dateKey] = { name: String(name || "").trim(), department: String(department || "").trim() };
          return;
        }
        if (Array.isArray(item)) {
          const [rawDate, name, department] = item;
          const dateKey = normalizeServerDateKey(rawDate);
          if (dateKey) parsed[dateKey] = { name: String(name || "").trim(), department: String(department || "").trim() };
        }
      });

      const final = { ...local, ...parsed };
      setRegisteredDetails(final);
    } catch (e) {
      console.error("Fallback 載入失敗:", e);
      setRegisteredDetails(local);
    }
  };

  // === 初始化：決定使用 Supabase 或 Fallback ===
  useEffect(() => {
    const initialize = async () => {
      if (hasSupabase && supabase) {
        setUseSupabase(true);
        await loadFromSupabase();
      } else {
        setUseSupabase(false);
        await loadFromFallback();
      }
      setIsClient(true);
    };

    initialize();
  }, []);

  // === Supabase Realtime 訂閱 ===
  useEffect(() => {
    if (!useSupabase || !supabase) return;

    // 訂閱報名資料變更
    const regsChannel = supabase
      .channel('public:registrations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations' },
        (payload) => {
          console.log('📡 Registrations 變更:', payload);
          loadFromSupabase(); // 重新載入資料
        }
      )
      .subscribe();

    // 訂閱活動日期變更
    const datesChannel = supabase
      .channel('public:event_dates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_dates' },
        (payload) => {
          console.log('📡 Event dates 變更:', payload);
          loadFromSupabase(); // 重新載入資料
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(regsChannel);
      supabase.removeChannel(datesChannel);
    };
  }, [useSupabase]);

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
            await supabase
              .from('registrations')
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
  
  const handleEditRegistration = (date: string) => {
    const details = registeredDetails[date];
    if (details) {
      setTempRegistrationData({ name: details.name, department: details.department });
      setEditingRegistrationDate(date);
    }
  };

  const handleSaveRegistration = async () => {
    if (!editingRegistrationDate) return;

    if (useSupabase && supabase) {
      try {
        const existingDetail = registeredDetails[editingRegistrationDate];
        
        if (existingDetail?.id) {
          // 更新現有記錄
          const { error } = await supabase
            .from('registrations')
            .update({
              name: tempRegistrationData.name,
              department: tempRegistrationData.department
            })
            .eq('id', existingDetail.id);

          if (error) throw error;
        } else {
          // 新增記錄
          const { error } = await supabase
            .from('registrations')
            .insert({
              name: tempRegistrationData.name,
              department: tempRegistrationData.department,
              event_date: editingRegistrationDate
            });

          if (error) throw error;
        }

        alert("儲存成功！");
      } catch (error) {
        console.error("儲存失敗:", error);
        alert("儲存失敗，請稍後再試");
      }
    } else {
      // Fallback: 本地更新
      setRegisteredDetails(prev => ({
        ...prev,
        [editingRegistrationDate]: tempRegistrationData,
      }));
    }

    setEditingRegistrationDate(null);
    setTempRegistrationData({ name: "", department: "" });
  };

  const handleCancelRegistration = () => {
    setEditingRegistrationDate(null);
    setTempRegistrationData({ name: "", department: "" });
  };

  const handleDeleteRegistration = async (date: string) => {
    if (!window.confirm("確定要刪除這個日期的報名資訊嗎？")) return;

    if (useSupabase && supabase) {
      try {
        const detail = registeredDetails[date];
        if (detail?.id) {
          const { error } = await supabase
            .from('registrations')
            .delete()
            .eq('id', detail.id);

          if (error) throw error;
          alert("刪除成功！");
        }
      } catch (error) {
        console.error("刪除失敗:", error);
        alert("刪除失敗，請稍後再試");
      }
    } else {
      // Fallback: 本地刪除
      setRegisteredDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[date];
        return newDetails;
      });
    }
  };

  const handleCardClick = (date: string) => {
    if (isEditingDates || editingRegistrationDate) return; 
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
        const { error } = await supabase
          .from('registrations')
          .insert({
            name: formData.name,
            department: formData.department,
            event_date: formData.date
          });

        if (error) throw error;
        
        alert("報名成功！");
        setShowForm(false);
        setFormData(prev => ({ name: prev.name, department: prev.department, date: "" }));
      } else {
        // Fallback: 使用 API
        const res = await fetch(SHEET_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) throw new Error("API 回應錯誤");

        alert("報名成功！");
        setShowForm(false);

        // 重新載入資料
        await loadFromFallback();
        setFormData(prev => ({ name: prev.name, department: prev.department, date: "" }));
      }
    } catch (error) {
      console.error("提交報名失敗:", error);
      alert("報名失敗，請稍後再試。");
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
          background: useSupabase ? '#4CAF50' : '#FF9800',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 1000
        }}>
          {useSupabase ? '🟢 Supabase' : '🟡 Fallback'}
        </div>
          {cards.map((card, i) => {
            const details = registeredDetails[card.date]; 
            const isCurrentlyEditing = editingRegistrationDate === card.date;
            // 取得該日期的所有報名者
            const dateRegistrations = allRegistrations.filter(
              reg => normalizeServerDateKey(reg.event_date) === card.date
            );
            
            return (
              <div
                key={i}
                className={`${styles.card} ${loadedIndexes.includes(i) ? styles.animateIn : ""}`}
                style={{ backgroundImage: `url(${card.image})` }}
                onClick={() => handleCardClick(card.date)}
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
                
                {/* 報名資訊顯示 / 編輯部分 */}
                {details && !isEditingDates ? (
                  <div className={styles.registrationDetailsWrapper}> 
                    {isCurrentlyEditing ? (
                      // 編輯模式
                      <div className={styles.registrationEdit}>
                        <input
                          type="text"
                          value={tempRegistrationData.department}
                          onChange={(e) => setTempRegistrationData(prev => ({ ...prev, department: e.target.value }))}
                          placeholder="部門"
                          className={styles.editInput}
                          onClick={(e) => e.stopPropagation()} 
                        />
                        <input
                          type="text"
                          value={tempRegistrationData.name}
                          onChange={(e) => setTempRegistrationData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="姓名"
                          className={styles.editInput}
                          onClick={(e) => e.stopPropagation()} 
                        />
                        <div className={styles.editButtonRow}>
                          <button onClick={(e) => { e.stopPropagation(); handleSaveRegistration(); }} className={styles.saveBtn}>儲存</button>
                          <button onClick={(e) => { e.stopPropagation(); handleCancelRegistration(); }} className={styles.cancelBtn}>取消</button>
                        </div>
                      </div>
                    ) : (
                      // 顯示模式
                      <>
                        <div className={styles.registrationInfo}>
                          <span>部門: {details.department}</span>
                          <span>姓名: {details.name}</span>
                        </div>
                        <div className={styles.actionButtonRow}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditRegistration(card.date); }} 
                            className={styles.actionBtn}
                          >
                            編輯
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteRegistration(card.date); }} 
                            className={styles.actionBtnDelete}
                          >
                            刪除
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  // 顯示報名按鈕或空狀態
                  <div className={styles.emptyRegistrationSpace}>
                    {!details && !isEditingDates && <p className={styles.emptyText}>點擊報名</p>}
                  </div>
                )}
                
                <button 
                  className={styles.registerButton}
                  disabled={isEditingDates || !!editingRegistrationDate} 
                >
                  報名
                </button>

                {/* 該日期的報名者列表 */}
                {dateRegistrations.length > 0 && (
                  <div className={styles.cardRegistrationsList} onClick={(e) => e.stopPropagation()}>
                    {dateRegistrations.map((reg, index) => (
                      <div key={reg.id} className={styles.cardRegistrationItem}>
                        <span className={styles.cardRegNumber}>{index + 1}.</span>
                        <span className={styles.cardRegName}>{reg.name}</span>
                        <span className={styles.cardRegDept}>({reg.department})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* 日期編輯按鈕 */}
          <button 
            className={styles.editBtn} 
            onClick={() => setIsEditingDates(prev => !prev)}
            disabled={!!editingRegistrationDate}
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
