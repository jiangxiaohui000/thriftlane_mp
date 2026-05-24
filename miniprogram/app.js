//app.js
const { phoneType } = require('./utils/phoneType');
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        traceUser: true,
      })
    }
    this.globalData = {};
    this.globalData.needAdaptIphoneX = phoneType();
    this.login(); // 静默登录，获取 openid
  },
  login: function(cb) {
    const _this = this;
    
    // 如果正在登录，就等待登录完成
    if (this._loginPromise) {
      this._loginPromise.then(openid => {
        typeof cb === 'function' && cb(openid);
      }).catch(e => {
        console.error('login Promise error:', e);
      });
      return;
    }
    
    if (this.globalData.openid) {
      typeof cb === 'function' && cb(_this.globalData.openid);
    } else {
      // 创建 Promise，防止重复调用
      const LOGIN_TIMEOUT = 8000; // 8秒超时
      this._loginPromise = new Promise((resolve, reject) => {
        const callPromise = wx.cloud.callFunction({ // 进入小程序先请求登录接口取用户的openid
          name: 'login',
          data: {},
        });
        const timeoutPromise = new Promise((_, timeoutReject) => {
          setTimeout(() => timeoutReject(new Error('login timeout')), LOGIN_TIMEOUT);
        });
        Promise.race([callPromise, timeoutPromise]).then(res => {
          if (res && res.result) {
            // 检查是否有错误
            if (res.result.error) {
              console.error('login error:', res.result.error);
              wx.showToast({
                title: '登录失败，请稍后再试~',
                icon: 'none',
              });
              reject(res.result.error);
              return;
            }
            
            if (res.result.openid) {
              _this.globalData.openid = res.result.openid;
              resolve(res.result.openid);
              // 拿到openid后给到用户集合
              wx.cloud.callFunction({ 
                name: 'addUserData',
                data: {
                  openid: res.result.openid
                },
              }).catch(err => {
                console.error('addUserData error:', err);
              });
            } else {
              console.error('openid not found in response');
              wx.showToast({
                title: '获取用户信息失败',
                icon: 'none',
              });
              reject('openid not found');
            }
          }
        }).catch(e => {
          console.error('login callFunction error:', e);
          wx.showToast({
            title: '登录异常，请稍后再试~',
            icon: 'none',
          });
          reject(e);
        })
      });
      
      // 登录完成后，执行回调
      this._loginPromise.then(openid => {
        typeof cb === 'function' && cb(openid);
      }).catch(e => {
        // 错误已经在上面处理了
      });
      
      // Promise 完成后，清除 _loginPromise
      this._loginPromise.finally(() => {
        this._loginPromise = null;
      });
    }
  },
	onShow: function() {
	},
	onHide: function() {
	}
})
