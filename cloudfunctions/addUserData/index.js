// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database()
  const _ = db.command
  try {
    const result = await db.collection('data_user').where({ uid: _.eq(event.openid) }).get()
    if(!result.data.length) { // 先判断当前openid在用户集合里有没有，没有的话加入到用户集合
      await db.collection('data_user').add({
        data: {
          uid: event.openid,
          collectedProducts: [],
        }
      })
    }
    return { result }
  } catch(e) {
    console.error('addUserData error:', e)
    return { error: e.message }
  }
}