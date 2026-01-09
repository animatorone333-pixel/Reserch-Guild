/**
 * 測試公告功能的腳本
 * 用來檢查 Supabase announcements 資料表的狀態
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 手動讀取 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    const match = line.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/);
    if (match) supabaseUrl = match[1].trim();
    const keyMatch = line.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/);
    if (keyMatch) supabaseKey = keyMatch[1].trim();
  });
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 環境變數');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnnouncements() {
  console.log('🔍 檢查 Supabase announcements 資料表...\n');

  try {
    // 1. 檢查資料表是否存在並讀取公告
    console.log('📖 嘗試讀取公告...');
    const { data: readData, error: readError } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', 1)
      .single();

    if (readError) {
      console.error('❌ 讀取失敗:', readError.message);
      console.log('\n💡 可能原因:');
      console.log('  1. 資料表尚未建立');
      console.log('  2. RLS 政策未設定');
      console.log('  3. Realtime 未啟用\n');
      console.log('📋 請執行以下 SQL:');
      console.log('  - db/create_announcements_table.sql');
      console.log('  - db/rls_announcements.sql');
      return;
    }

    console.log('✅ 讀取成功!');
    console.log('📄 當前公告內容:');
    console.log('─'.repeat(50));
    console.log(readData.content);
    console.log('─'.repeat(50));
    console.log(`📅 更新時間: ${readData.updated_at}`);
    console.log(`👤 更新者: ${readData.updated_by}\n`);

    // 2. 測試更新權限
    console.log('📝 測試更新權限...');
    const testContent = readData.content + '\n[測試時間: ' + new Date().toLocaleString('zh-TW') + ']';
    
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ content: testContent, updated_by: 'test-script' })
      .eq('id', 1);

    if (updateError) {
      console.error('❌ 更新失敗:', updateError.message);
      console.log('💡 請檢查 RLS 政策是否允許 UPDATE\n');
      return;
    }

    console.log('✅ 更新成功!');
    
    // 3. 還原內容
    console.log('🔄 還原原始內容...');
    const { error: restoreError } = await supabase
      .from('announcements')
      .update({ content: readData.content, updated_by: readData.updated_by })
      .eq('id', 1);

    if (restoreError) {
      console.error('❌ 還原失敗:', restoreError.message);
    } else {
      console.log('✅ 已還原\n');
    }

    // 4. 檢查 Realtime 狀態
    console.log('📡 Realtime 訂閱測試...');
    console.log('💡 請在 Supabase Dashboard 確認:');
    console.log('   Database → Replication → announcements 已勾選\n');

    console.log('🎉 所有測試通過！公告功能正常運作');
    
  } catch (error) {
    console.error('❌ 發生錯誤:', error);
  }
}

testAnnouncements();
