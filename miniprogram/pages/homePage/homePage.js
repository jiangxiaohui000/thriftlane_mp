//homePage.js
const app = getApp();
const QQMapWX = require('../../utils/qqmap-wx-jssdk.js'); // 引入腾讯位置服务
const { checkNetworkStatus } = require('../../utils/checkNetworkStatus');
const { QQ_MAP_KEY } = require('../../utils/config');
const { calculatingHeat, calculatingPrice } = require('../../utils/productUtils');

Page({
  data: {
    logged: false,
    takeSession: false,
    requestResult: '',
    // productsCategory: ['精选', '手机', '男装', '女装', '数码', '日用', '图书', '饰品', '美妆', '百货', '箱包', '运动'],
    productsList: [],
    swiperImgs: [],
    scrollTop: 0,
    searchKeyWord: '',
    currentIndex: 0,
    selectedItemLeft: undefined,
    locationText: '定位中...', // 定位显示文本：定位中/小区名/完整地址
    locationFlash: true,
    locationAuthorized: false, // 是否已获得定位授权
    showLocationAuthModal: false, // 是否显示位置授权引导弹窗
    heatIconList: [],
    notHeatIconList: [],
    pageData: {
      pageSize: 20,
      currentPage: 1,
    },
    showLoading: true,
    hasMore: true, // 是否还有更多商品可加载（分页用，不再与 loading 态混用）
    isLoaded: false,
    openid: '',
    isOwn: '0',
    userLongitude: '', // 用户经度
    userLatitude: '', // 用户纬度
    hasRelevantData: true, // 有相关地理位置数据
    initCount: 0, // 统计initData执行的次数，在第一次执行时，判断有没有用户地理位置相关数据
  },

  onLoad() {
    if (!wx.cloud) {
      wx.showModal({
        title: '提示',
        content: '请使用 2.2.3 或以上的基础库以使用云能力',
        showCancel: false,
      });
      return;
    }
    app.login(res => this.data.openid = res); // 调用全局登录方法获取openid
    checkNetworkStatus(); // 网络状态检测
    wx.showLoading({ title: '加载中...' });
    // 不进入即自动获取位置：位置属隐私接口，需用户手势触发且先经隐私授权
    // 先加载全部商品，用户点击左上角定位图标后再按位置筛选
    this.setData({ locationText: '', locationFlash: true, locationAuthorized: false });
    this.initData('', ''); // 不带位置，加载全部商品
		wx.disableAlertBeforeUnload();
  },
  onUnload() {
  },
  // 数据初始化
  initData(userLongitude, userLatitude) {
    this.data.initCount++;
    this.setData({ showLoading: true });
    wx.cloud.callFunction({
      name: 'getProductsData',
      data: {
        pageData: this.data.pageData,
        isSold: '0',
        isOff: '0',
        isDeleted: '0',
        userLongitude: userLongitude,
        userLatitude: userLatitude,
      },
      success: res => {
        wx.hideLoading();
        wx.stopPullDownRefresh();
        if(res && res.result && res.result.data && res.result.data.data && res.result.data.data.length) { // 查找到数据
          const data = res.result.data.data;
          data.forEach(item => {
            const { heatIconList, notHeatIconList } = calculatingHeat(item);
            const { newCurrentPrice, newOriginPrice } = calculatingPrice(item);
            item.heatIconList = heatIconList;
            item.notHeatIconList = notHeatIconList;
            item.currentPrice = newCurrentPrice;
            item.originPrice = newOriginPrice;
            item.displayImg = item.img[0];
            item.isOwn = item.uid === app.globalData.openid ? '1' : '0';
          });
          this.setData({
            productsList: [...this.data.productsList, ...data],
            showLoading: false,
            hasMore: data.length === this.data.pageData.pageSize,
            hasRelevantData: this.data.initCount === 1 && data.length,
            isLoaded: true,
            swiperImgs: [{
              _id: 1,
              img: '../../images/banner1.jpg'
            }, {
              _id: 2,
              img: '../../images/banner2.jpg'
            }, {
              _id: 3,
              img: '../../images/banner3.jpg'
            }]
          });
        } else { // 没有相关数据
          // 如果带位置查询没结果，降级为不带位置查全部；若已经是不带位置查询仍无结果则不再递归
          if(userLongitude || userLatitude) {
            this.initData('', '');
          } else {
            this.setData({ showLoading: false, hasMore: false, isLoaded: true });
          }
        }
      },
      fail: e => {
        wx.hideLoading();
        wx.stopPullDownRefresh();
        wx.showToast({
          title: '服务繁忙，请稍后再试~',
          icon: 'none'
        })
      }
    })
  },
  // 位置授权弹窗：用户点击"去授权"按钮，跳转系统设置页
  onGetLocationSuccess() {
    this.setData({ showLocationAuthModal: false });
    wx.openSetting({
      success: data => {
        if (data.authSetting['scope.userLocation']) {
          wx.showLoading({ title: '加载中...' });
          this.data.productsList = [];
          this.data.initCount = 0;
          wx.getLocation({
            type: 'gcj02',
            success: res => {
              this.data.userLongitude = res.longitude;
              this.data.userLatitude = res.latitude;
              this.initData(this.data.userLongitude, this.data.userLatitude);
              this.useQQMap(res.latitude, res.longitude, this);
            },
            fail: () => this.initData('', '')
          });
        }
      }
    });
  },
  // 位置授权弹窗：用户点击"暂不授权"
  onSkipLocation() {
    this.setData({ showLocationAuthModal: false });
  },
  // 用户自己选择位置
  goLocationPage() {
    const _this = this;
    wx.chooseLocation({
      success: res => {
        this.data.productsList = [];
        this.data.initCount = 0;
        this.data.userLongitude = res.longitude;
        this.data.userLatitude = res.latitude;
        this.initData(this.data.userLongitude, this.data.userLatitude);
        this.useQQMap(res.latitude, res.longitude, _this);
      },
      fail: e => {
        // 用户拒绝授权或定位服务未开启
        if (e.errMsg && e.errMsg.indexOf('auth deny') > -1) {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中开启位置权限，以便为您展示附近的宝贝',
            confirmText: '去设置',
            cancelText: '取消',
            success: modalRes => {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: settingRes => {
                    if (settingRes.authSetting['scope.userLocation']) {
                      // 授权成功后重新调用
                      this.goLocationPage();
                    }
                  }
                });
              }
            }
          });
        }
      }
    });
  },
  // 使用腾讯位置服务
  useQQMap(latitude, longitude, _this) {
    const qqmapsdk = new QQMapWX({
      key: QQ_MAP_KEY
    });
    qqmapsdk.reverseGeocoder({
      location: { latitude, longitude },
      get_poi: 1, // 开启周边 POI 返回，用于提取小区信息
      success: res => {
        const result = res.result;
        const address = result.formatted_addresses && result.formatted_addresses.recommend || '';
        app.globalData.userLocation = {
          longitude: longitude,
          latitude: latitude,
          address: address,
        };

        // 从 pois 里找最近的住宅小区
        // 腾讯地图 category 中住宅区通常是 "房产;住宅区;住宅小区" 或 "房产;住宅区"
        const pois = result.pois || [];
        let nearbyEstate = '';
        const residentialPoi = pois.find(poi =>
          poi.category && (
            poi.category.indexOf('住宅') > -1 ||
            poi.category.indexOf('小区') > -1 ||
            poi.category.indexOf('公寓') > -1
          )
        );
        if (residentialPoi) {
          nearbyEstate = residentialPoi.title;
        } else {
          // 降级：尝试从 address_reference.landmark_l1 获取地标名
          const landmark = result.address_reference && result.address_reference.landmark_l1;
          if (landmark && landmark.title) {
            nearbyEstate = landmark.title;
          }
        }

        _this.setData({
          locationText: nearbyEstate || address, // 优先小区名，降级完整地址
          locationFlash: false,
          locationAuthorized: true,
        });
      },
      fail: e => { // 腾讯位置服务出错
        wx.showToast({
          title: '服务繁忙，请稍后再试~',
          icon: 'none',
        });
        _this.setData({
          locationFlash: false,
        });
      }
    });
  },
  // 下拉刷新
	onPullDownRefresh() {
    this.setData({ hasMore: true });
    this.data.productsList = [];
    this.data.pageData.currentPage = 1;
    this.data.initCount = 0;
    this.initData(this.data.userLongitude, this.data.userLatitude);
  },
  // 触底加载更多
  onReachBottom() {
    if(this.data.hasMore && !this.data.showLoading) {
      this.data.pageData.currentPage += 1;
      this.initData(this.data.userLongitude, this.data.userLatitude);
    }
  },
  // 页面滚动
  onPageScroll(e) {
    this.setData({
      scrollTop: e.scrollTop
    })
  },
  // 前往商品详情页面
  toProductsDetail(e) {
    const targetItem = e.currentTarget.dataset.item;
    // 用买方、卖方、商品的ID组成一个groupId
    const groupId = `${app.globalData.openid}${targetItem._id}${targetItem.uid}`;
    wx.navigateTo({
      url: '../productDetail/productDetail',
      success: function(res) {
        res.eventChannel.emit('toProductDetail', { _id: targetItem._id, groupId: groupId, isOwn: targetItem.isOwn });
      }
    });
  },
  // 前往搜索页
  gotoSearch() {
    wx.navigateTo({
      url: '../search/search',
    })
  },
  // 点击轮播图
  bannerClick(e) {
  },
})
