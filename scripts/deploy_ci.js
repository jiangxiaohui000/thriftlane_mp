/**
 * 使用 miniprogram-ci 部署小程序代码 + 云函数
 *
 * 前提：
 *   1. 已在 package.json 中安装 miniprogram-ci（当前 devDependencies 已有）
 *   2. 在微信公众平台「开发 → 开发设置 → 小程序代码上传」生成并下载上传密钥
 *   3. 设置环境变量 PRIVATE_KEY_PATH 指向密钥文件
 *
 * 用法：
 *   export PRIVATE_KEY_PATH='/path/to/private.key'
 *   export CLOUD_ENV='cloud1-1gdhscygd67ee3f4'   # 可选，默认即此值
 *   node scripts/deploy_ci.js
 */

const ci = require('miniprogram-ci');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = path.resolve(__dirname, '..');
const APPID = 'wx55fc31983d95bce8';
const CLOUD_ENV = process.env.CLOUD_ENV || 'cloud1-1gdhscygd67ee3f4';
const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH;

if (!PRIVATE_KEY_PATH) {
  console.error('❌ 请设置 PRIVATE_KEY_PATH 环境变量，指向小程序上传密钥文件');
  console.error('    export PRIVATE_KEY_PATH="/path/to/private.key"');
  process.exit(1);
}

if (!fs.existsSync(PRIVATE_KEY_PATH)) {
  console.error(`❌ 密钥文件不存在: ${PRIVATE_KEY_PATH}`);
  process.exit(1);
}

// 需要部署的云函数列表
const FUNCTIONS = [
  'addMessageData', 'addUserData', 'authorizationRevoke', 'clearUnreadCount', 'feedback',
  'getMessageData', 'getProductsData', 'getProductsInfoData', 'getUserData',
  'imgSecCheck', 'login', 'msgSecCheck', 'postProduct',
  'removeChatsData', 'removeMessageData', 'search', 'searchHotKey',
  'updateProductsData', 'updateUserData',
];

async function main() {
  console.log('=== miniprogram-ci 部署 ===');
  console.log(`环境: ${CLOUD_ENV}`);
  console.log(`工程: ${PROJECT_DIR}`);
  console.log(`密钥: ${PRIVATE_KEY_PATH}`);
  console.log('');

  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: PROJECT_DIR,
    privateKeyPath: PRIVATE_KEY_PATH,
    ignores: ['node_modules/**/*', 'miniprogram/node_modules/**/*', '.git/**/*'],
  });

  // 1) 上传小程序代码（自动构建 npm）
  console.log('--- 步骤1: 上传小程序代码 ---');
  try {
    const uploadResult = await ci.upload({
      project,
      version: process.env.VERSION || '1.0.0',
      desc: process.env.DESC || 'CI 自动部署',
      setting: {
        es6: true,
        es7: true,
        minify: true,
        autoPrefixWXSS: true,
      },
    });
    console.log(`✓ 上传成功: ${uploadResult.subPackageInfo || '主包'}`);
  } catch (e) {
    console.error('✗ 上传失败:', e.message);
    process.exit(1);
  }

  // 2) 部署云函数（逐个上传）
  console.log('');
  console.log('--- 步骤2: 部署云函数 ---');
  for (const name of FUNCTIONS) {
    const fnPath = path.join(PROJECT_DIR, 'cloudfunctions', name);
    if (!fs.existsSync(path.join(fnPath, 'index.js'))) {
      console.warn(`⚠ 跳过 ${name}: 缺少 index.js`);
      continue;
    }
    try {
      await ci.cloud.uploadFunction({
        project,
        name,
        path: fnPath,
        env: CLOUD_ENV,
        remoteNpmInstall: true, // 云端自动安装依赖
      });
      console.log(`✓ ${name}`);
    } catch (e) {
      console.error(`✗ ${name}: ${e.message}`);
    }
  }

  console.log('');
  console.log('=== 部署完成 ===');
}

main().catch(e => {
  console.error('部署异常:', e);
  process.exit(1);
});
