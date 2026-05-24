// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;
  const data = {};

  // 降价：使用 !== undefined 判断，避免价格为 0 被当作 falsy 跳过
  if (event.currentPrice !== undefined) {
    data.currentPrice = +event.currentPrice;
  }

  // 下架(isOff='1') / 重新上架(isOff='0')
  if (event.isOff !== undefined && event.isOff !== null && event.isOff !== '') {
    data.isOff = event.isOff === '1';
  }
  // 卖出(isSold='1') / 重新卖(isSold='0')
  if (event.isSold !== undefined && event.isSold !== null && event.isSold !== '') {
    data.isSold = event.isSold === '1';
  }

  if (event.isDeleted !== undefined) {
    data.isDeleted = event.isDeleted === '1';
  }
  if (event.isCollected !== undefined) {
    data.isCollected = event.isCollected;
  }

  let result;
  try {
    result = await db.collection('data_products').where({ _id: _.eq(event._id), uid: _.eq(event.uid) }).update({ data: data });  
  } catch(e) {
    console.error('updateProductsData error:', e);
    return {
      status: 500,
      errMsg: e.message || 'update failed',
    };
  }
  if(result && result.stats && result.stats.updated) {
    return {
      status: 200,
      errMsg: 'ok',
      data: event,
    }
  } else {
    return {
      status: 200,
      errMsg: 'no matching record to update',
    }
  }
}