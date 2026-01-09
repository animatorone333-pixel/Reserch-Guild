#!/usr/bin/env node

/**
 * 公告管理工具
 * 用法:
 *   node scripts/manage-announcements.js get          # 讀取當前公告
 *   node scripts/manage-announcements.js update "內容" # 更新公告
 */

const http = require('http');

const PORT = 3000;
const HOST = 'localhost';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function getAnnouncement() {
  console.log('📖 讀取當前公告...\n');
  
  try {
    const response = await makeRequest('GET', '/api/announcements');
    
    if (response.success) {
      console.log('✅ 讀取成功！\n');
      console.log('📄 公告內容:');
      console.log('─'.repeat(60));
      console.log(response.data.content);
      console.log('─'.repeat(60));
      console.log(`\n📅 更新時間: ${response.data.updated_at}`);
      console.log(`👤 更新者: ${response.data.updated_by}`);
    } else {
      console.error('❌ 讀取失敗:', response.error);
    }
  } catch (error) {
    console.error('❌ 連線失敗:', error.message);
    console.log('\n💡 請確保開發伺服器正在運行: npm run dev');
  }
}

async function updateAnnouncement(content) {
  console.log('📝 更新公告...\n');
  
  try {
    const response = await makeRequest('POST', '/api/announcements', {
      content: content,
      updatedBy: 'admin-script',
    });
    
    if (response.success) {
      console.log('✅ 更新成功！\n');
      console.log('📄 新的公告內容:');
      console.log('─'.repeat(60));
      console.log(response.data.content);
      console.log('─'.repeat(60));
      console.log(`\n📅 更新時間: ${response.data.updated_at}`);
    } else {
      console.error('❌ 更新失敗:', response.error);
    }
  } catch (error) {
    console.error('❌ 連線失敗:', error.message);
    console.log('\n💡 請確保開發伺服器正在運行: npm run dev');
  }
}

// 主程式
const command = process.argv[2];
const arg = process.argv[3];

console.log('🎯 公告管理工具\n');

if (command === 'get') {
  getAnnouncement();
} else if (command === 'update') {
  if (!arg) {
    console.error('❌ 錯誤: 請提供公告內容');
    console.log('\n用法: node scripts/manage-announcements.js update "您的公告內容"');
    process.exit(1);
  }
  updateAnnouncement(arg);
} else {
  console.log('用法:');
  console.log('  node scripts/manage-announcements.js get              # 讀取當前公告');
  console.log('  node scripts/manage-announcements.js update "內容"    # 更新公告');
  console.log('\n範例:');
  console.log('  node scripts/manage-announcements.js get');
  console.log('  node scripts/manage-announcements.js update "💌最新公告\\n🔸下次活動在1/15舉行"');
}
