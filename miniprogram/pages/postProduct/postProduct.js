// pages/postProduct/postProduct.js
const app = getApp();
const { money } = require('../../utils/moneyInputLimit');
const QQMapWX = require('../../utils/qqmap-wx-jssdk.js'); // 引入腾讯位置服务
const { QQ_MAP_KEY } = require('../../utils/config');
const { imgSecCheck, uploadImg } = require('../../utils/productUtils');

Page({
  data: {
    productDesc: '',
    imageList: [],
    releaseDisabled: true, // 商品描述，图片，价格是必填的，其他选填
    price: '',
    originPrice: '',
    resultText: '',
    toptipsType: '',
    toptipsShow: false,
    galleryShow: false,
    imgUrls: [], // 图片预览
    currentImgIndex: 0,
    classifyList: [{
      value: 0,
      label: '手机'
    }, {
      value: 1,
      label: '电脑'
    }, {
      value: 2,
      label: '数码3C'
    }, {
      value: 3,
      label: '运动户外'
    }, {
      value: 4,
      label: '服饰鞋帽'
    }, {
      value: 5,
      label: '美妆护肤'
    }, {
      value: 6,
      label: '生活百货'
    }, {
      value: 7,
      label: '其他'
    }],
    selectedClassify: '',
    finenessTagList: [{
      value: 0,
      label: '全新'
    }, {
      value: 1,
      label: '几乎全新'
    }, {
      value: 2,
      label: '轻微使用痕迹'
    }, {
      value: 3,
      label: '明显使用痕迹'
    }],
    selectedTag: '',
    brandName: '',
    brandTagShow: false,
    userAddress: '',
    userInfo: '',
    fileIdArr: [], // 上传后返回的文件ID
    tempFilePaths: [], // 图片临时文件
    imgSecCheckArr: [], // 安全检查结果
    longitude: '', // 经度
    latitude: '', // 纬度
    userLocation: '',
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if(options && options.params) {
      const params = JSON.parse(options.params);
      this.data.productDesc = params.desc || '';
      this.data.imageList = params.img || [];
      this.data.price = params.currentPrice || '';
      this.data.originPrice = params.originPrice || '';
      this.setData({
        productDesc: this.data.productDesc,
        imageList: this.data.imageList,
        imgUrls: this.data.imageList,
        price: this.data.price,
        originPrice: this.data.originPrice,
        releaseDisabled: !(this.data.productDesc && this.data.imageList.length && this.data.price),
      });
    }
    let eventChannel = this.getOpenerEventChannel();
    // 发布
    eventChannel.on('sendImage', res => {
      if(res && res.filePath) {
        this.setData({
          imageList: res.filePath,
          imgUrls: res.filePath,
        });
      }
      res && res.userInfo && (this.data.userInfo = res.userInfo);
      res && res.fileIdArr && (this.data.fileIdArr = res.fileIdArr);
    });
    // 编辑
    eventChannel.on('toEdit', res => {
      res && res.productDesc && (this.data.productDesc = res.productDesc);
      res && res.imageList && (this.data.imageList = res.imageList);
      res && res.price && (this.data.price = res.price);
      this.setData({
        productDesc: this.data.productDesc,
        imageList: this.data.imageList,
        imgUrls: this.data.imageList,
        price: this.data.price,
        releaseDisabled: !(this.data.productDesc && this.data.imageList.length && this.data.price),
      })
    });
    if(app.globalData.userLocation) {
      this.data.userLocation = app.globalData.userLocation;
      this.setData({
        userAddress: this.data.userLocation.address,
      });
    } else {
      const _this = this;
      wx.getSetting({
        success: res => {
          this.getUserLocation(res, _this); // 获取用户位置信息
        }
      });  
    }
    wx.enableAlertBeforeUnload({
      message: '确定退出吗？\n退出后已编辑的内容将不会被保存'
    });
  },
  // 上传图片
	addImage: function () {
	wx.chooseMedia({ // 1,选择图片
		count: 9 - this.data.imageList.length,
		mediaType: ['image'],
		sizeType: ['compressed'],
		sourceType: ['album', 'camera'],
		success: res => {
      const imgSecCheckArr = []; // 安全检查结果（局部变量，避免直接操作 this.data）
      let imgSecCheckCount = 0; // 已完成安全检查的数量
      const tempFiles = res.tempFiles; // 临时文件（包含临时文件路径和大小）
			const tempFilesLength = res.tempFiles.length; // 临时文件数量
      this.data.tempFilePaths = tempFiles.map(f => f.tempFilePath); // 临时文件路径
      if(tempFiles.some(item => item.size / 1024 / 1024 > 3)) {
				this.setData({
					toptipsShow: true,
					resultText: '图片大小不得超过 5MB，请重新选择',
					toptipsType: 'info',
				});
				return;
			}
			wx.showLoading({
				title: '请稍候...',
				mask: true,
			});
		  const concurrencyCtrl = { active: 0, queue: [] }; // 并发控制，最多同时检查3张
		  tempFiles.forEach((item) => {
          const size = item.size;
          const path = item.tempFilePath; // chooseMedia 用 tempFilePath
          if(size / 1024 / 1024 > 1) { // 图片大小超过1M，压缩后再进行安全检查
					wx.compressImage({ src: path,	quality: 20 }).then(compressResult => {
						const handledPath = compressResult.tempFilePath;
						this.imgSecCheck(handledPath, imgSecCheckArr, tempFilesLength, () => { imgSecCheckCount++; return imgSecCheckCount; }, concurrencyCtrl);
					}).catch(err => {
						console.error('compressImage error:', err);
						imgSecCheckCount++;
					})
				} else { // 图片大小小于1M，直接进行安全检查
					this.imgSecCheck(path, imgSecCheckArr, tempFilesLength, () => { imgSecCheckCount++; return imgSecCheckCount; }, concurrencyCtrl);
          }
		  });
		},
			fail: e => {
			}
		})
	},
	// 图片安全检查（调用公共工具函数，带并发控制）
	imgSecCheck(filePath, imgSecCheckArr, tempFilesLength, getCount, concurrencyCtrl) {
		imgSecCheck(this, filePath, imgSecCheckArr, tempFilesLength, getCount, () => {
			this.data.tempFilePaths.forEach((item, index1) => {
				this.uploadImg(item, index1, tempFilesLength);
			});
		}, concurrencyCtrl);
	},
	// 将图片上传（调用公共工具函数）
	uploadImg(item, index1, tempFilesLength) {
		uploadImg(this, item, index1, tempFilesLength, 'post', () => {
			this.data.imageList.push(...this.data.tempFilePaths);
			this.setData({
				imageList: this.data.imageList,
				imgUrls: this.data.imageList,
				releaseDisabled: !(this.data.productDesc && this.data.imageList.length && this.data.price),
			});
		});
	},
  // 图片预览
  imgPreview(e) {
    wx.showLoading();
    this.setData({
      currentImgIndex: e.currentTarget.dataset.index,
    });
    const timer = setTimeout(() => {
      wx.hideLoading();
      this.setData({
        galleryShow: true,
      });
      clearTimeout(timer);
    }, 500);
  },
  // 删除图片
  deleteImg(e) {
    this.data.imageList.splice(e.currentTarget.dataset.index, 1);
    this.setData({
      imageList: this.data.imageList,
      releaseDisabled: !(this.data.productDesc && this.data.imageList.length && this.data.price),
    });
  },
  // 商品描述--确认输入
  textareaConfirm(e) {
    this.setData({
      productDesc: e.detail.value,
      releaseDisabled: !(e.detail.value && this.data.imageList.length && this.data.price),
    })
  },
  // 商品描述--输入中
  textareaInput(e) {
    this.setData({
      productDesc: e.detail.value,
    });
    if(e.detail.value.length == 300) {
      this.setData({
        toptipsShow: true,
        resultText: '已经到达输入字数限制！',
        toptipsType: 'info',
      })
    }
  },
  // 输入当前价格
  priceInput(e) {
    if(+e.detail.value >= 100000000) {
      this.setData({
        toptipsShow: true,
        resultText: '商品价格必须在0元与1亿元之间哦~',
        toptipsType: 'info',
      });
    }
    this.setData({
      price: money(e.detail.value),
      releaseDisabled: !(this.data.productDesc && this.data.imageList.length && money(e.detail.value)) || e.detail.value >= 100000000,
    })
  },
  // 输入入手价格
  originPriceInput(e) {
    if(+e.detail.value >= 100000000) {
      this.setData({
        toptipsShow: true,
        resultText: '商品价格必须在0元与1亿元之间哦~',
        toptipsType: 'info',
      });
    }
    this.setData({
      originPrice: money(e.detail.value),
      releaseDisabled: !(this.data.productDesc && this.data.imageList.length && money(e.detail.value)) || e.detail.value >= 100000000,
    })
  },
  // 选择分类
  chooseClassify(e) {
    const value = e.currentTarget.dataset.item.value;
    this.data.selectedClassify = this.data.selectedClassify === value ? '' : value; 
    this.setData({
      selectedClassify: this.data.selectedClassify
    })
  },
  // 选择标签 -- 成色
  chooseTag(e) {
    const value = e.currentTarget.dataset.item.value;
    this.data.selectedTag = this.data.selectedTag === value ? '' : value;
    this.setData({
      selectedTag: this.data.selectedTag
    })
  },
  // 发布
  releaseProduct() {
    if(this.data.productDesc && this.data.imageList.length && this.data.price) {
      wx.showLoading({ title: '发布中...' });
      wx.cloud.callFunction({
        name: 'msgSecCheck',
        data: { content: this.data.productDesc }
      }).then(res => {
        const errCode = res.result?.errCode ?? res.errCode;
        if(errCode == 0) { // 信息安全检查成功
          const params = {
            productDesc: this.data.productDesc,
            imageList: this.data.fileIdArr, // 直接用 cloud:// fileID，永不过期
            price: this.data.price,
                  originPrice: this.data.originPrice,
                  classify: this.data.selectedClassify,
                  brandName: this.data.brandName,
                  finenessTag: this.data.selectedTag,
                  userAddress: this.data.userLocation ? this.data.userLocation.address : this.data.userAddress,
                  avatarUrl: this.data.userInfo.avatarUrl,
                  nickName: this.data.userInfo.nickName,
                  isCollected: [],
                  isOff: false,
                  isDeleted: false,
                  isSold: false,
                  uid: app.globalData.openid,
                  latitude:  this.data.userLocation ? this.data.userLocation.latitude : this.data.latitude,
                  longitude:  this.data.userLocation ? this.data.userLocation.longitude : this.data.longitude,
                }
                wx.cloud.callFunction({ // 调用发布接口
                  name: 'postProduct',
                  data: params,
                  success: res => {
                    wx.hideLoading();
                    wx.disableAlertBeforeUnload();
                    wx.showToast({
                      title: '发布成功',
                      icon: 'success',
                    });
                    const pages = getCurrentPages(); // 获取页面栈
                    const prevPage = pages[pages.length - 2]; // 跳转之前的页面
                    prevPage.setData({
                      postSuccess: true,
                    });
                    const timer = setTimeout(() => {
                      wx.navigateBack({
                        delta: 1,
                      });
                      clearTimeout(timer);
                    }, 600);
                  },
                  fail: e => {
                    wx.hideLoading();
                    wx.showToast({
                      title: '服务繁忙，请稍后再试~',
                      icon: 'none'
                    })
                  }
                })
        } else if(errCode == 87014) { // 发布违规内容
          wx.hideLoading();
          this.setData({
            resultText: '不得发布违法违规内容，请重新输入！',
            toptipsShow: true,
            toptipsType: 'error',
          });
        }
      }).catch(e => {
        wx.hideLoading();
        wx.showToast({
          title: '服务繁忙，请稍后再试~',
          icon: 'none'
        });
      })
    }
  },
  // 品牌名称输入，失去焦点生成tag
  brandInputBlur(e) {
    if(e.detail.value !== '') {
      this.setData({
          brandName: e.detail.value,
          brandTagShow: true,
        })   
    }
  },
  // 删除品牌tag
  deleteBrandTag() {
    this.setData({
      brandTagShow: false,
      brandName: '',
    })
  },
  // 自动获取用户位置
  getUserLocation(res, _this) {
    if(res.authSetting['scope.userLocation']) { // 用户授权位置信息
      wx.getLocation({
        type: 'gcj02',
        success: res => { // 先获取到经纬度
          this.data.latitude = res.latitude;
          this.data.longitude = res.longitude;
          this.useQQMap(res.latitude, res.longitude, _this);
        },
        fail: e => { // 未获取到经纬度
          let errorMsg = '自动定位失败';
          if (e.errMsg) {
            if (e.errMsg.indexOf('auth deny') > -1) {
              errorMsg = '您拒绝了位置授权，请在设置中开启位置权限';
            } else if (e.errMsg.indexOf('timeout') > -1) {
              errorMsg = '定位超时，请检查GPS是否开启';
            } else if (e.errMsg.indexOf('fail') > -1) {
              errorMsg = '定位失败，请确保已开启位置服务';
            }
          }
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          });
        }
      })
    } else {
      // 用户未授权位置，引导授权
      wx.showModal({
        title: '需要位置权限',
        content: '请授权位置信息，以便为您展示地理位置',
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.authorizeLocation();
          }
        }
      });
    }
  },
  // 使用腾讯位置服务
  useQQMap(latitude, longitude, _this) {
    const qqmapsdk = new QQMapWX({
      key: QQ_MAP_KEY
    });
    qqmapsdk.reverseGeocoder({ // 再通过腾讯位置服务获取到地理位置
      location: { latitude, longitude },
      success: res => {
        _this.setData({
          userAddress: res.result.formatted_addresses.recommend,
        });
      },
      fail: e => { // 腾讯位置服务出错
      }
    });
  },
  // 引导开启位置授权（由用户点击弹框"去设置"后调用，触发链合规）
  authorizeLocation() {
    wx.openSetting({
      success: data => {
        if (data.authSetting["scope.userLocation"]) { // 已授权位置信息
          wx.getLocation({
            type: 'gcj02',
            success: res => {
              this.data.latitude = res.latitude;
              this.data.longitude = res.longitude;
              this.useQQMap(res.latitude, res.longitude, this);
            }
          });
        }
      },
      fail: () => {
        wx.showToast({ title: '服务繁忙，请稍后再试~', icon: 'none' });
      },
    });
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    if(this.data.productDesc || this.data.imageList.length || this.data.price) {
      wx.disableAlertBeforeUnload();
    }
    this.data.fileIdArr = [];
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})