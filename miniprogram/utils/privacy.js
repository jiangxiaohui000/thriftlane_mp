/**
 * 微信隐私合规统一处理
 * - 注册 wx.onNeedPrivacyAuthorize：任何隐私接口（getLocation/chooseLocation 等）触发时弹窗
 * - 首次启动主动检测：若平台要求授权且尚未同意，则弹窗引导用户阅读并同意《隐私保护指引》
 * 注意：隐私政策的文本内容需在 MP 后台「设置 -> 服务内容 -> 用户隐私保护指引」中配置，
 *       用户点击「查看」会调用 wx.openPrivacyContract() 打开后台配置的政策。
 */

let modalShown = false

// 展示隐私授权弹窗；resolve 由 wx.onNeedPrivacyAuthorize 提供，调用即代表记录用户授权结果
function showPrivacyModal(resolve) {
  if (modalShown) return
  modalShown = true
  let resolved = false
  const safeResolve = (result) => {
    if (resolved) return
    resolved = true
    if (typeof resolve === 'function') {
      resolve(result)
    }
  }
  wx.showModal({
    title: '隐私保护指引',
    content: '感谢使用拾旧坊。在使用前，请阅读并同意《隐私保护指引》。我们仅在为你提供"附近的二手好物"时获取你的地理位置信息，且不会用于其他用途。',
    confirmText: '同意并继续',
    cancelText: '暂不使用',
    success: (res) => {
      modalShown = false
      if (res.confirm) {
        safeResolve({ event: 'agree', resolve: true })
      } else {
        safeResolve({ event: 'disagree', resolve: false })
      }
    },
    fail: () => {
      modalShown = false
      safeResolve({ event: 'disagree', resolve: false })
    },
  })
}

function initPrivacy() {
  // 基础库低于 2.32.3 不支持隐私接口，直接跳过（旧版微信不受此限制）
  if (typeof wx.onNeedPrivacyAuthorize !== 'function') {
    return
  }

  // 1) 被动：任何隐私接口调用触发授权需求时弹出
  wx.onNeedPrivacyAuthorize((resolve) => {
    showPrivacyModal(resolve)
  })

  // 2) 主动：首次启动若平台要求授权，则提前引导用户同意（用户体验更好，也避免一进首页就弹系统定位）
  wx.getPrivacySetting({
    success: (res) => {
      if (res.needAuthorization) {
        wx.requirePrivacyAuthorize({
          success: () => {},
          fail: () => {},
        })
      }
    },
    fail: () => {},
  })
}

module.exports = { initPrivacy }
