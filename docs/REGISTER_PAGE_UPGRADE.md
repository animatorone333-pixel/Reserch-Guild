# 📋 報名頁面升級說明

## ✨ 新功能

### 1. **版面全面置中** ✅
- 採用垂直置中設計，整體頁面置中顯示
- 上方：報名卡片區（原有的三張活動卡片，縮小顯示）
- 中央：即時報名名單區（新增，寬度 90%）

### 2. **Supabase 即時同步** ✅
- 所有報名資料即時顯示
- 任何人報名後，所有瀏覽器立即更新
- 使用 WebSocket 訂閱 `registrations` 資料表變更

### 3. **名單依序往下排** ✅
- 報名者依時間順序顯示（最早在上）
- 顯示格式：`序號. 姓名 (部門) 日期`
- 自動捲軸，支援大量報名者

---

## 🎨 新增樣式

### 報名名單區域（置中）
- **背景**：半透明淺黃色 `rgba(255, 246, 230, 0.95)`
- **邊框**：4px 深棕色邊框 `#6c4b2a`
- **標題**：像素字體 "📋 報名名單"
- **尺寸**：寬度 90%（最大 800px），最高 400px
- **捲軸**：深金色自訂捲軸
- **位置**：頁面中央主要區域

### 報名項目樣式
- **hover 效果**：向右平移 + 背景變深
- **排版**：
  - 序號（左側）
  - 姓名（粗體）
  - 部門（括號內）
  - 日期（右側，背景強調）

---

## 📊 資料結構

### 新增介面
```typescript
interface RegistrationItem {
  id: number;
  name: string;
  department: string;
  event_date: string;
  created_at: string;
}
```

### 新增狀態
```typescript
const [allRegistrations, setAllRegistrations] = useState<RegistrationItem[]>([]);
```

---

## 🔧 技術實作

### 1. Supabase 載入邏輯更新
```typescript
// 載入所有報名資料
const { data: regsData } = await supabase
  .from('registrations')
  .select('*')
  .order('created_at', { ascending: true });

// 設定完整報名列表
setAllRegistrations(regsData);
```

### 2. Realtime 訂閱
已存在的訂閱會自動更新 `allRegistrations`：
```typescript
supabase
  .channel('public:registrations')
  .on('postgres_changes', { event: '*', ... }, () => {
    loadFromSupabase(); // 重新載入包含 allRegistrations
  })
```

### 3. 顯示邏輯
```typescript
allRegistrations.map((reg, index) => (
  <div key={reg.id} className={styles.registrationRow}>
    <span>{index + 1}.</span>
    <span>{reg.name}</span>
    <span>({reg.department})</span>
    <span>{normalizeServerDateKey(reg.event_date)}</span>
  </div>
))
```

---

## 🚀 部署步驟

### 1. 執行 Supabase SQL
在 **Supabase Dashboard → SQL Editor** 執行：
```bash
db/setup_registrations_complete.sql
```

這會設定：
- ✅ 資料表結構
- ✅ RLS 政策（SELECT, INSERT, UPDATE, DELETE）
- ✅ Realtime 發布
- ✅ 索引與觸發器

### 2. 檢查環境變數
確認 `.env.local` 有：
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. 本地測試
```bash
npm run dev
```

開啟 http://localhost:3000/register

**驗證項目**：
- ✅ 頁面右上角顯示 `🟢 Supabase`
- ✅ 中央置中區域看到「📋 報名名單」區塊
- ✅ 嘗試報名，名單立即更新
- ✅ 開啟多個瀏覽器視窗，同步更新

### 4. 部署到 Vercel
```bash
git add .
git commit -m "feat: 報名頁面升級 - 置中+即時名單+依序顯示"
git push origin main
```

確認 Vercel 環境變數已設定（同步 `.env.local`）。

---

## 📱 響應式設計

目前設計已採用垂直置中佈局，適合桌面和手機瀏覽器：
- `.pageWrapper` 已使用 `flex-direction: column`
- 報名名單寬度已設為 `width: 90%`（最大 800px）
- 卡片區已縮小至 0.7 倍以節省空間

---

## 🐛 除錯

### 問題：名單沒有顯示
1. 檢查 Supabase SQL 是否執行成功
2. F12 Console 看是否有錯誤
3. 確認 RLS 政策已啟用

### 問題：不是即時更新
1. 確認 Realtime 已在 Supabase 啟用
2. 檢查 `ALTER PUBLICATION` 是否成功
3. 重新訂閱頻道

### 問題：顯示 🟡 Fallback
1. 檢查環境變數是否正確
2. 重啟開發伺服器

---

## 📝 未來優化建議

1. **分頁功能**：報名者超過 100 人時分頁顯示
2. **搜尋功能**：按姓名或部門搜尋
3. **匯出功能**：下載 CSV 或 Excel
4. **統計圖表**：各日期報名人數統計
5. **報名截止**：設定截止時間自動關閉報名

---

## ✅ 完成清單

- [x] 版面置中設計
- [x] Supabase 即時同步
- [x] 名單依序顯示
- [x] RLS 政策設定
- [x] Realtime 訂閱
- [x] CSS 樣式美化
- [x] 錯誤處理
- [x] 文件撰寫

🎉 **報名頁面升級完成！**
