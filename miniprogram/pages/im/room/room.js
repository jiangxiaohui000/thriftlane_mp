const app = getApp()

Page({
  data: {
    avatarUrl: '../../images/user-unlogin.png',
    logged: false,
    takeSession: false,
    requestResult: '',
    chatRoomEnvId: 'cloud1-1gdhscygd67ee3f4',
    chatRoomCollection: 'data_chat',
    groupId: '',
    chatInfo: {},
    openid: '',
    authorizationApplicationDialogShow: false,
    buyer_nickName: '',
    buyer_avatarUrl: '',
    hasUserInfo: false,
    productInfo: null,
  },

  onLoad: function(options) {
    this.getSystemInfo();
    this.data.openid = app.globalData.openid;
    this.data.groupId = options.groupId;
    this.data.productInfo = JSON.parse(options.productInfo);
    this.data.buyer_nickName = this.data.productInfo.buyer_nickName;
    this.data.buyer_avatarUrl = this.data.productInfo.buyer_avatarUrl;
    
    // 清除未读消息计数
    wx.cloud.callFunction({
      name: 'clearUnreadCount',
      data: {
        groupId: this.data.groupId,
      },
    });
    // const nickName = wx.getStorageSync('nickName');
    // const avatarUrl = wx.getStorageSync('avatarUrl');
    // if(options.seller_uid !== this.data.openid) { // 如果传过来的卖家ID不是当前账户的openID，则存储的昵称和头像是买家的
    //  	this.data.buyer_nickName = nickName;
    //   this.data.buyer_avatarUrl = avatarUrl;
    // }
    if(!this.data.openid) { // 未登录
      app.login(res => this.setData({ openid: res })); // 调用全局登录方法获取openid
			if(this.data.openid) { // 拿到openid后判断为已登录状态
				wx.setStorageSync('openid', this.data.openid);
        app.globalData.openid = this.data.openid;
        this.setData({
          openid: this.data.openid,
        });
			}
    }
    this.data.authorizationApplicationDialogShow = !this.data.buyer_nickName || !this.data.buyer_avatarUrl; // 没有昵称或者头像，则弹窗提示授权
    this.data.hasUserInfo = this.data.buyer_nickName && this.data.buyer_avatarUrl; // 同时有昵称和头像则表示有用户信息
    if(!this.data.hasUserInfo) { // 没有用户信息则赋值默认值
      this.data.buyer_nickName = '微信用户';
      this.data.buyer_avatarUrl = 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLgo5ychFeqjfjsLia7HnyymiawHq6b5guj0RNKID3EmN9ticOwBTutRB3v8ibA8sYxNr5icJ7IZSZibc2A/0';
    }
    this.data.chatInfo = {
      buyer_nickName: this.data.buyer_nickName,
      buyer_avatarUrl: this.data.buyer_avatarUrl,
      buyer_uid: this.data.openid,
      seller_nickName: this.data.productInfo.seller_nickName,
      seller_avatarUrl: this.data.productInfo.seller_avatarUrl,
      seller_uid: this.data.productInfo.seller_uid,
      img: this.data.productInfo.img,
      price: this.data.productInfo.price,
      productId: this.data.productInfo.productId,
    };
    this.setData({
      chatInfo: this.data.chatInfo,
      groupId: this.data.groupId,
      openid: this.data.openid,
      authorizationApplicationDialogShow: this.data.authorizationApplicationDialogShow,
    });
  },
	// 弹窗 -- 获取授权
	tapAuthorizationButton(e) {
		this.setData({
			authorizationApplicationDialogShow: false,
		});
		if(e.detail.index) { // 同意授权
			this.onGetUserInfo();
		} else { // 拒绝授权
      this.data.buyer_nickName = '微信用户';
      this.data.buyer_avatarUrl = 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLgo5ychFeqjfjsLia7HnyymiawHq6b5guj0RNKID3EmN9ticOwBTutRB3v8ibA8sYxNr5icJ7IZSZibc2A/0';
      this.data.hasUserInfo = false;
      this.data.chatInfo = {
        buyer_nickName: this.data.buyer_nickName,
        buyer_avatarUrl: this.data.buyer_avatarUrl,
        buyer_uid: this.data.openid,
        seller_nickName: this.data.productInfo.seller_nickName,
        seller_avatarUrl: this.data.productInfo.seller_avatarUrl,
        seller_uid: this.data.productInfo.seller_uid,
        img: this.data.productInfo.img,
        price: this.data.productInfo.price,
        productId: this.data.productInfo.productId,
      };
      this.setData({
        chatInfo: this.data.chatInfo,
        groupId: this.data.groupId,
        openid: this.data.openid,
      });
		}
	},
	// 获取用户信息 — 新版：通过 chooseAvatar 回调触发，此处直接从 storage 读取
	onGetUserInfo() {
		if(!this.data.hasUserInfo) {
			// 新版无法主动弹窗，引导用户前往"我的"页面设置头像和昵称
			const nickName = wx.getStorageSync('nickName');
			const avatarUrl = wx.getStorageSync('avatarUrl');
			if (nickName && avatarUrl) {
				this.data.buyer_nickName = nickName;
				this.data.buyer_avatarUrl = avatarUrl;
			} else {
				this.data.buyer_nickName = '微信用户';
				this.data.buyer_avatarUrl = 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLgo5ychFeqjfjsLia7HnyymiawHq6b5guj0RNKID3EmN9ticOwBTutRB3v8ibA8sYxNr5icJ7IZSZibc2A/0';
			}
			this.data.chatInfo = {
				buyer_nickName: this.data.buyer_nickName,
				buyer_avatarUrl: this.data.buyer_avatarUrl,
				buyer_uid: this.data.openid,
				seller_nickName: this.data.productInfo.seller_nickName,
				seller_avatarUrl: this.data.productInfo.seller_avatarUrl,
				seller_uid: this.data.productInfo.seller_uid,
				img: this.data.productInfo.img,
				price: this.data.productInfo.price,
				productId: this.data.productInfo.productId,
			};
			wx.setStorageSync('nickName', this.data.buyer_nickName);
			wx.setStorageSync('avatarUrl', this.data.buyer_avatarUrl);
			this.data.hasUserInfo = true;
			this.setData({
				chatInfo: this.data.chatInfo,
				groupId: this.data.groupId,
				openid: this.data.openid,
			});
		}
  },
  // 获取系统信息
  getSystemInfo() {
    const res = wx.getWindowInfo();
    if (res.safeArea) {
      const { bottom } = res.safeArea;
      this.setData({
        containerStyle: `padding-bottom: ${20 + res.windowHeight - bottom}px`,
      });
    }
  },
})
