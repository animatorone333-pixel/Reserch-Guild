// /register/page.tsx (最終修正版：同步載入表單數據，確保 F5 與跨頁持久化)

"use client";
import { useEffect, useState, useLayoutEffect } from "react"; 
import styles from "./page.module.css";
import { useRouter } from "next/navigation";

const SHEET_API_URL = "/api/sheet";
const DATE_STORAGE_KEY = "register_page_dates_v3"; 
const REGISTRATION_DETAILS_KEY = "registration_details_v1"; 
const FORM_INPUT_KEY = "form_input_v1"; // 🔑 用來儲存姓名和部門的 Key

// 登錄數據結構
interface FormData {
  name: string;
  department: string;
  date: string;
}

interface CardData {
  date: string;
  image: string;
}

// 儲存報名資訊的結構 
interface RegisteredDetail {
    name: string;
    department: string;
}

// 預設日期卡片
const defaultDateCards: CardData[] = [
  { date: "10/13", image: "/game_16.png" },
  { date: "11/26", image: "/game_17.png" },
  { date: "12/10", image: "/game_18.png" },
];

// 載入持久化資料函數 - 日期卡片
const loadCards = (): CardData[] => {
  if (typeof window === 'undefined') return defaultDateCards;
  const storedJson = localStorage.getItem(DATE_STORAGE_KEY);
  if (storedJson) {
    try {
      const parsedDates: string[] = JSON.parse(storedJson);
      return defaultDateCards.map((defaultCard, i) => ({
        ...defaultCard,
        date: parsedDates[i] || defaultCard.date, 
      }));
    } catch (e) {
      console.error("Failed to parse stored dates:", e);
      localStorage.removeItem(DATE_STORAGE_KEY); 
    }
  }
  return defaultDateCards;
};

// 載入持久化資料函數 - 報名詳情
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

// 載入持久化資料函數 - 表單輸入 (姓名/部門)
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
  
  // 🔑 關鍵修正：在初始化時同步載入姓名和部門，確保第一個 Render 就有資料
  const initialFormInput = loadFormInput();
  const [formData, setFormData] = useState<FormData>({ 
    name: initialFormInput.name, 
    department: initialFormInput.department, 
    date: "" 
  }); 

  // 狀態初始化 (其他數據仍需在 useEffect 載入)
  const [cards, setCards] = useState<CardData[]>(defaultDateCards); 
  const [registeredDetails, setRegisteredDetails] = useState<Record<string, RegisteredDetail>>({});
  
  // 其他狀態
  const [loadedIndexes, setLoadedIndexes] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false); 
  const [editingRegistrationDate, setEditingRegistrationDate] = useState<string | null>(null);
  const [tempRegistrationData, setTempRegistrationData] = useState<{ name: string; department: string }>({ name: "", department: "" });
  
  // 追蹤客戶端是否完成載入 (主要用於卡片/報名詳情/動畫)
  const [isClient, setIsClient] = useState(false); 


  // 🔑 步驟一：使用 useLayoutEffect 處理非 Form Data 的同步載入，並確保即時儲存
  useLayoutEffect(() => {
    // 1. Hydrate Cards
    setCards(loadCards());
    
    // 2. Hydrate Registration Details
    setRegisteredDetails(loadRegistrationDetails());
    
    setIsClient(true);
  }, []); 

  // 🔑 步驟二：專門用於即時儲存 (姓名/部門) - 不再依賴 isFormLoaded 
  useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
        // 只要 name 或 department 改變，就立即寫入 localStorage
        localStorage.setItem(FORM_INPUT_KEY, JSON.stringify({ name: formData.name, department: formData.department }));
    }
  }, [formData.name, formData.department]); 


  // 數據持久化 - 日期卡片
  // ✅ 修正：等到第一次從 localStorage 載入完成 (isClient 為 true) 之後才開始覆寫
  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && isClient) { 
        const datesToPersist = cards.map(card => card.date);
        localStorage.setItem(DATE_STORAGE_KEY, JSON.stringify(datesToPersist));
    }
  }, [cards, isClient]);
  
  // 數據持久化 - 報名詳情
  // ✅ 修正：同樣等初始化載入完成後才寫回 localStorage，避免一進頁面就把舊資料覆蓋成空的 {}
  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && isClient) {
        localStorage.setItem(REGISTRATION_DETAILS_KEY, JSON.stringify(registeredDetails));
    }
  }, [registeredDetails, isClient]);


  // 動畫邏輯 (保持不變)
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    defaultDateCards.forEach((_, i) => {
      const timer = setTimeout(() => {
        setLoadedIndexes(prev => [...prev, i]);
      }, 500 + i * 150);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []); 

  // --- 函數區 (保持不變) ---

    const handleDateChange = (index: number, newDate: string) => {
      // 先保存舊的日期值
      const oldDate = cards[index].date;
      
      setCards(prevCards => 
        prevCards.map((card, i) => 
          i === index ? { ...card, date: newDate } : card
        )
      );
      setRegisteredDetails(prev => {
        const newDetails = { ...prev };
        // 如果這個日期原本就有報名資訊，改日期時一併把資料跟著搬到新日期
        if (oldDate !== newDate && newDetails[oldDate]) {
          newDetails[newDate] = newDetails[oldDate];
          delete newDetails[oldDate];
        }
        return newDetails;
      });
    };
  
  const handleEditRegistration = (date: string) => {
      const details = registeredDetails[date];
      if (details) {
          setTempRegistrationData({ name: details.name, department: details.department });
          setEditingRegistrationDate(date);
      }
  };

  const handleSaveRegistration = () => {
      if (editingRegistrationDate) {
          setRegisteredDetails(prev => ({
              ...prev,
              [editingRegistrationDate]: tempRegistrationData,
          }));
          setEditingRegistrationDate(null);
          setTempRegistrationData({ name: "", department: "" });
      }
  };

  const handleCancelRegistration = () => {
      setEditingRegistrationDate(null);
      setTempRegistrationData({ name: "", department: "" });
  };

  const handleDeleteRegistration = (date: string) => {
      if (window.confirm("確定要刪除這個日期的報名資訊嗎？")) {
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
      const res = await fetch(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json(); 

      alert("報名成功！");
      setShowForm(false);
      
      setRegisteredDetails(prev => ({
          ...prev,
          [formData.date]: {
              name: formData.name,
              department: formData.department
          }
      }));

      setFormData(prev => ({ 
          name: prev.name, 
          department: prev.department, 
          date: "" 
      }));
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
        {cards.map((card, i) => {
          const details = registeredDetails[card.date]; 
          const isCurrentlyEditing = editingRegistrationDate === card.date; 
          
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