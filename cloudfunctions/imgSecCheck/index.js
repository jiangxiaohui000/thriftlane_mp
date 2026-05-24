// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 根据文件路径推断 MIME 类型
function getContentType(filePath) {
  if (!filePath) return 'image/jpeg';
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
  };
  return map[ext] || 'image/jpeg';
}

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const res = await axios({
      method: 'get',
      url: event.imgData,
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: { "Content-Type": "*" }
    });
    const buffer = res.data;
    const contentType = getContentType(event.filePath);
    const result = await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: contentType,
        value: Buffer.from(buffer)
      }
    });
    return result;
  } catch (error) {
    return {
      errCode: -1,
      errMsg: error.message || '图片检查服务异常',
      detail: error
    };
  }
}