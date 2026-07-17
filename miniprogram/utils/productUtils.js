/**
 * 商品相关公共工具函数
 * 从 homePage、search、collectedProducts、soldProducts、me 中提取的重复逻辑
 */

const { priceConversion } = require('./priceConversion');

/**
 * 计算商品热度图标列表
 * @param {Object} item - 商品数据，需包含 isCollected 数组
 * @returns {{ heatIconList: any[], notHeatIconList: any[] }}
 */
function calculatingHeat(item) {
  const heatIconList = [];
  const notHeatIconList = [];
  let heat = 0;
  const collectedArrLength = item.isCollected.length;
  if (collectedArrLength > 0 && collectedArrLength <= 10) {
    heat = 1;
  } else if (collectedArrLength > 10 && collectedArrLength <= 20) {
    heat = 2;
  } else if (collectedArrLength > 20 && collectedArrLength <= 30) {
    heat = 3;
  } else if (collectedArrLength > 30 && collectedArrLength <= 40) {
    heat = 4;
  } else if (collectedArrLength > 40) {
    heat = 5;
  }
  heatIconList.length = heat;
  notHeatIconList.length = 5 - heat;
  return { heatIconList, notHeatIconList };
}

/**
 * 格式化商品价格显示
 * @param {Object} item - 商品数据，需包含 currentPrice / originPrice
 * @returns {{ newCurrentPrice: string, newOriginPrice: string }}
 */
function calculatingPrice(item) {
  const newCurrentPrice = priceConversion(item.currentPrice);
  const newOriginPrice = priceConversion(item.originPrice);
  return { newCurrentPrice, newOriginPrice };
}

/**
 * 图片安全检查（带并发控制，最多同时检查3张）
 * @param {Object} ctx - Page 或 Component 实例（提供 setData / data）
 * @param {string} filePath - 待检查图片的临时路径
 * @param {Array}  imgSecCheckArr - 收集检查结果的数组（外部维护）
 * @param {number} tempFilesLength - 本批次图片总数
 * @param {Function} getCount - 调用后自增并返回已完成数量的函数
 * @param {Function} onAllPassed - 所有图片通过后的回调（由调用方执行上传）
 * @param {Object} concurrencyCtrl - 并发控制对象 { active: number, queue: Array }
 */
function imgSecCheck(ctx, filePath, imgSecCheckArr, tempFilesLength, getCount, onAllPassed, concurrencyCtrl = null) {
  // 如果没有传入并发控制对象，直接执行（保持兼容）
  if (concurrencyCtrl) {
    if (concurrencyCtrl.active >= 3) {
      // 达到并发上限，加入队列
      concurrencyCtrl.queue.push({ ctx, filePath, imgSecCheckArr, tempFilesLength, getCount, onAllPassed, concurrencyCtrl });
      return;
    }
    concurrencyCtrl.active++;
  }

  wx.cloud.callFunction({
    name: 'imgSecCheck',
    data: {
      filePath: filePath,
      imgData: wx.cloud.CDN({
        type: 'filePath',
        filePath: filePath,
      }),
    },
  }).then(secCheckResult => {
    imgSecCheckArr.push(secCheckResult);
    const count = getCount();
    if (count === tempFilesLength) { // 所有图片都检查完成
      const errCode = secCheckResult.result?.errCode ?? secCheckResult.errCode;
      const hasPass = imgSecCheckArr.every(item => {
        const code = item.result?.errCode ?? item.errCode;
        return code === 0;
      });
      const hasViolation = imgSecCheckArr.some(item => {
        const code = item.result?.errCode ?? item.errCode;
        return code == 87014;
      });
      if (hasPass) { // 全部通过
        onAllPassed();
      } else if (hasViolation) { // 违规
        wx.hideLoading();
        ctx.setData({
          resultText: '不得上传违法违规内容，请重新选择！',
          toptipsShow: true,
          toptipsType: 'error',
        });
      } else { // 服务异常
        wx.hideLoading();
        ctx.setData({
          resultText: '服务异常，请稍后再试~',
          toptipsShow: true,
          toptipsType: 'error',
        });
      }
    }
    // 处理并发队列
    if (concurrencyCtrl) {
      concurrencyCtrl.active--;
      if (concurrencyCtrl.queue.length > 0) {
        const next = concurrencyCtrl.queue.shift();
        imgSecCheck(next.ctx, next.filePath, next.imgSecCheckArr, next.tempFilesLength, next.getCount, next.onAllPassed, next.concurrencyCtrl);
      }
    }
  }).catch(() => {
    wx.hideLoading();
    wx.showToast({ title: '服务繁忙，请稍后再试~', icon: 'none' });
    // 异常时也要处理队列
    if (concurrencyCtrl) {
      concurrencyCtrl.active--;
      if (concurrencyCtrl.queue.length > 0) {
        const next = concurrencyCtrl.queue.shift();
        imgSecCheck(next.ctx, next.filePath, next.imgSecCheckArr, next.tempFilesLength, next.getCount, next.onAllPassed, next.concurrencyCtrl);
      }
    }
  });
}

/**
 * 上传单张图片到云存储
 * @param {Object} ctx - Page 或 Component 实例
 * @param {string} item - 临时文件路径
 * @param {number} index - 当前图片在批次中的索引（从 0 开始）
 * @param {number} tempFilesLength - 本批次图片总数
 * @param {string} prefix - 云存储路径前缀，用于区分来源（如 'post' / 'me'）
 * @param {Function} onAllUploaded - 全部上传完成后的回调
 */
function uploadImg(ctx, item, index, tempFilesLength, prefix, onAllUploaded) {
  wx.cloud.uploadFile({
    cloudPath: 'temp/' + new Date().getTime() + '-' + prefix + '-' + Math.floor(Math.random() * 1000),
    filePath: item,
    success: uploadFileResult => {
      const fileID = uploadFileResult.fileID;
      ctx.data.fileIdArr.push(fileID);
      if (!ctx._uploadCount) ctx._uploadCount = 0;
      ctx._uploadCount++;
      wx.hideLoading();
      if (ctx._uploadCount >= tempFilesLength) { // 全部上传完成
        ctx._uploadCount = 0;
        onAllUploaded();
      }
    },
    fail: () => {
      wx.hideLoading();
      wx.showToast({ title: '上传失败，请稍后再试~', icon: 'error' });
    },
  });
}

module.exports = {
  calculatingHeat,
  calculatingPrice,
  imgSecCheck,
  uploadImg,
};
