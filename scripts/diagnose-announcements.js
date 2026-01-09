#!/usr/bin/env node

/**
 * Supabase 公告功能診斷工具
 * 檢查 announcements 表格的設定是否正確
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 讀取環境變數
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

console.log('🔍 Supabase 公告功能診斷工具');
console.log('═'.repeat(60));
console.log('');

// 檢查環境變數
console.log('📋 步驟 1: 檢查環境變數');
console.log('─'.repeat(60));

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 環境變數');
  console.log('\n請在 .env.local 設定:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  process.exit(1);
}

console.log(`✅ URL: ${supabaseUrl}`);

// 檢查 API key 格式
if (supabaseKey.startsWith('eyJ')) {
  console.log('✅ API Key 格式正確 (eyJ 開頭)');
} else {
  console.log('⚠️  API Key 格式可能不正確');
  console.log(`   當前格式: ${supabaseKey.substring(0, 20)}...`);
  console.log('   正確格式應以 "eyJ" 開頭');
}

console.log('');

// 建立 Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  try {
    // 測試 1: 檢查資料表是否可存取
    console.log('📋 步驟 2: 測試資料表存取');
    console.log('─'.repeat(60));
    
    const { data: allData, error: listError } = await supabase
      .from('announcements')
      .select('*');
    
    if (listError) {
      console.error('❌ 無法存取 announcements 資料表');
      console.error('   錯誤:', listError.message);
      console.error('   代碼:', listError.code);
      console.error('   提示:', listError.hint);
      console.log('\n💡 可能原因:');
      console.log('   1. 資料表不存在');
      console.log('   2. RLS 政策阻擋了讀取權限');
      console.log('   3. API key 無效');
      console.log('\n📝 解決方法:');
      console.log('   在 Supabase SQL Editor 執行:');
      console.log('   - db/create_announcements_table.sql');
      console.log('   - db/rls_announcements.sql');
      return;
    }
    
    console.log(`✅ 資料表可存取，共有 ${allData?.length || 0} 筆記錄`);
    
    if (allData && allData.length > 0) {
      console.log('\n📄 資料表內容:');
      allData.forEach(record => {
        console.log(`   ID: ${record.id}`);
        console.log(`   內容: ${record.content?.substring(0, 50)}...`);
        console.log(`   更新者: ${record.updated_by}`);
        console.log(`   更新時間: ${record.updated_at}`);
        console.log('');
      });
    }
    
    console.log('');
    
    // 測試 2: 檢查 id=1 的記錄
    console.log('📋 步驟 3: 檢查 id=1 的記錄');
    console.log('─'.repeat(60));
    
    const { data: singleData, error: singleError } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (singleError) {
      if (singleError.code === 'PGRST116') {
        console.log('⚠️  找不到 id=1 的記錄');
        console.log('\n📝 建議: 插入預設公告');
        console.log('   在 Supabase SQL Editor 執行:');
        console.log(`   INSERT INTO announcements (id, content, updated_by) VALUES`);
        console.log(`   (1, '💌最新公告\\n歡迎使用！', 'system')`);
        console.log(`   ON CONFLICT (id) DO NOTHING;`);
      } else {
        console.error('❌ 查詢失敗:', singleError.message);
      }
      console.log('');
    } else {
      console.log('✅ id=1 的記錄存在');
      console.log(`   內容預覽: ${singleData.content?.substring(0, 100)}...`);
      console.log('');
    }
    
    // 測試 3: 測試更新權限
    console.log('📋 步驟 4: 測試更新權限');
    console.log('─'.repeat(60));
    
    const testTime = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ updated_at: testTime })
      .eq('id', 1);
    
    if (updateError) {
      console.error('❌ 無更新權限');
      console.error('   錯誤:', updateError.message);
      console.log('\n📝 解決方法:');
      console.log('   在 Supabase SQL Editor 執行:');
      console.log('   CREATE POLICY "Allow public update" ON announcements');
      console.log('     FOR UPDATE TO public USING (true) WITH CHECK (true);');
    } else {
      console.log('✅ 有更新權限');
    }
    
    console.log('');
    
    // 總結
    console.log('═'.repeat(60));
    console.log('📊 診斷總結');
    console.log('═'.repeat(60));
    
    if (!listError && !singleError && !updateError) {
      console.log('🎉 所有測試通過！公告功能應該可以正常使用');
      console.log('\n✅ 檢查項目:');
      console.log('   ✓ 環境變數正確');
      console.log('   ✓ 資料表可存取');
      console.log('   ✓ id=1 記錄存在');
      console.log('   ✓ 有更新權限');
      console.log('\n🚀 現在可以:');
      console.log('   1. 在首頁直接編輯公告');
      console.log('   2. 訪問測試頁面: http://localhost:3000/test-announcements');
    } else {
      console.log('⚠️  發現問題，請依照上方建議修正');
    }
    
  } catch (error) {
    console.error('❌ 診斷過程發生錯誤:', error);
  }
}

diagnose();
