#!/bin/bash

# 首頁公告 Supabase 快速設定腳本

echo "🎯 首頁公告 Supabase 設定助手"
echo "================================"
echo ""

# 檢查環境變數
echo "📋 步驟 1: 檢查環境變數..."
if [ ! -f .env.local ]; then
    echo "❌ 找不到 .env.local 檔案"
    echo ""
    echo "請建立 .env.local 並加入以下內容："
    echo "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
    exit 1
fi

SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d '=' -f2)
SUPABASE_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d '=' -f2)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "❌ 環境變數未設定"
    exit 1
fi

# 檢查 API key 格式
if [[ ! $SUPABASE_KEY == eyJ* ]]; then
    echo "⚠️  警告: API key 格式可能不正確"
    echo "   正確的 key 應該以 'eyJ' 開頭"
    echo "   請到 Supabase Dashboard → Settings → API 複製 anon/public key"
    echo ""
fi

echo "✅ 環境變數已設定"
echo "   URL: $SUPABASE_URL"
echo "   Key: ${SUPABASE_KEY:0:20}..."
echo ""

# 顯示 SQL 設定步驟
echo "📋 步驟 2: 在 Supabase 執行 SQL"
echo "================================"
echo ""
echo "請前往 Supabase Dashboard → SQL Editor"
echo "並依序執行以下 SQL 檔案："
echo ""
echo "  1️⃣  建立資料表："
echo "     📄 db/create_announcements_table.sql"
echo ""
echo "  2️⃣  設定 RLS 政策："
echo "     📄 db/rls_announcements.sql"
echo ""
echo "  3️⃣  啟用 Realtime："
echo "     SQL Editor 執行："
echo "     ALTER PUBLICATION supabase_realtime ADD TABLE announcements;"
echo ""
echo "     或在 Dashboard → Database → Replication 勾選 announcements"
echo ""

read -p "按 Enter 繼續查看 SQL 內容..."
echo ""

echo "════════════════════════════════════════════════════════════"
echo "📄 1. 建立資料表 SQL (db/create_announcements_table.sql)"
echo "════════════════════════════════════════════════════════════"
cat db/create_announcements_table.sql
echo ""
echo ""

echo "════════════════════════════════════════════════════════════"
echo "📄 2. RLS 政策 SQL (db/rls_announcements.sql)"
echo "════════════════════════════════════════════════════════════"
cat db/rls_announcements.sql
echo ""
echo ""

echo "════════════════════════════════════════════════════════════"
echo "📄 3. 啟用 Realtime SQL"
echo "════════════════════════════════════════════════════════════"
echo "ALTER PUBLICATION supabase_realtime ADD TABLE announcements;"
echo ""
echo ""

# 提供測試指令
echo "✅ SQL 設定完成後，執行以下測試："
echo "================================"
echo ""
echo "1️⃣  啟動開發伺服器："
echo "   npm run dev"
echo ""
echo "2️⃣  開啟首頁並嘗試編輯公告："
echo "   http://localhost:3000"
echo ""
echo "3️⃣  或使用管理腳本（需先啟動 dev server）："
echo "   node scripts/manage-announcements.js get"
echo "   node scripts/manage-announcements.js update \"新的公告內容\""
echo ""
echo "4️⃣  測試即時同步："
echo "   開啟兩個瀏覽器視窗，在一個編輯，另一個應立即更新"
echo ""
echo ""
echo "📚 完整文件請參考："
echo "   docs/ANNOUNCEMENTS_MANAGEMENT.md"
echo ""
echo "🎉 設定完成！"
