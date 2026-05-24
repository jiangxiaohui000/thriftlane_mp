const app = getApp()
const { priceConversion } = require('../../utils/priceConversion');
const { money } = require('../../utils/moneyInputLimit');
const { checkNetworkStatus } = require('../../utils/checkNetworkStatus');
const { imgSecCheck, uploadImg } = require('../../utils/productUtils');

Page({
	data: {
		userInfo: {
			avatarUrl: '../../images/user-unlogin.png',
			nickName: '',
		},
		logged: false,
		takeSession: false,
		productsList: [],
		postNum: 0,
		mineItems: [{
			value: 0,
			label: '卖出',
			icon: 'maichu1',
			num: 0
		}, {
			value: 1,
			label: '收藏',
			icon: 'collection-b',
			num: 0
		},
		// {
		// 	value: 2,
		// 	label: '购买',
		// 	icon: 'gouwujianying',
		// 	num: 0
		// }, {
		// 	value: 3,
		// 	label: '评价',
		// 	icon: 'pingjia',
		// 	num: 0
		// }
		],
		dialogShow: false,
		dialogImg: '',
		currentPrice: '',
		modifiedPrice: '',
		toptipsShow: false,
		toptipsType: '',
		resultText: '',
		pageData: {
			pageSize: 20,
			currentPage: 1,
		},
		showLoading: false,
		openid: '',
		hasUserInfo: false,
		currentDataId: '',
		isOwn: '0',
		tempFilePaths: [], // 图片临时文件
		fileIdArr: [], // 传给发布页面的文件ID
		// 用户信息设置弹窗
		showUserInfoModal: false,
		tempAvatarUrl: '',
		tempNickName: '',
	},
	onLoad: function() {
		if (!wx.cloud) {
			wx.showModal({
				title: '提示',
				content: '请使用 2.2.3 或以上的基础库以使用云能力',
				showCancel: false,
			});
			return;
		}
		checkNetworkStatus(); // 检测网络状态

		// 静默登录：直接获取 openid，无需用户授权
		if (app.globalData.openid) {
			this.setData({ openid: app.globalData.openid });
			wx.showLoading({ title: '加载中...' });
			this.initData();
		} else {
			app.login(openid => {
				this.setData({ openid });
				wx.showLoading({ title: '加载中...' });
				this.initData();
			});
		}
	},
	onShow() {
		const pages = getCurrentPages(); // 获取页面栈
		const currPage = pages[pages.length - 1]; // 跳转之后的页面
		this.data.pageData.currentPage = 1;
		this.data.productsList = [];
		if(currPage.data.postSuccess) { // 发布商品
			wx.showLoading();
			this.getReleasedData();
		} else if(currPage.data.isResold) { // 重新卖
			wx.showLoading();
			this.getReleasedData();
			this.getSoldData();
		}
		wx.disableAlertBeforeUnload();
	},
	// 数据初始化
	initData() {
		// 读取本地存储的用户信息
		const avatarUrl = wx.getStorageSync('avatarUrl') || '../../images/user-unlogin.png';
		const nickName = wx.getStorageSync('nickName') || '';
		this.setData({
			'userInfo.avatarUrl': avatarUrl,
			'userInfo.nickName': nickName,
			hasUserInfo: !!(avatarUrl && nickName && nickName !== '微信用户'),
		});

		const promise1 = wx.cloud.callFunction({ // 列表展示的
			name: 'getProductsData',
			data: {
				pageData: this.data.pageData,
				uid: this.data.openid,
				isSold: '0',
				isDeleted: '0',
			}
		});
		const promise2 = wx.cloud.callFunction({ // 卖出的
			name: 'getProductsData',
			data: {
				uid: this.data.openid,
				isSold: '1',
				isDeleted: '0',
			}
		});
		const promise3 = wx.cloud.callFunction({ // 收藏的
			name: 'getUserData',
			data: {
				uid: this.data.openid,
			}
		});
		Promise.all([promise1, promise2, promise3]).then(res => {
			wx.hideLoading();
			wx.stopPullDownRefresh();
			if(res && res.length) {
				const data1 = res[0];
				const data2 = res[1];
				const data3 = res[2];
				if(data1 && data1.result && data1.result.data && data1.result.data.data && data1.result.count && data1.result.count.total) { // 发布的商品
					const data = data1.result.data.data;
					const total = data1.result.count.total;
					data.map(item => {
						item.currentPrice = priceConversion(item.currentPrice);
						item.displayImg = item.img[0];
						item.isOwn = item.uid == this.data.openid ? '1' : '0';
						return item;
					});
					this.setData({
						productsList: [...this.data.productsList, ...data],
						postNum: total,
            showLoading: !!data.length,
					});
				}
			  if(data2 && data2.result && data2.result.count) { // 卖出的商品
					const total = data2.result.count.total;
					this.data.mineItems[0].num = total;
					this.setData({
						mineItems: this.data.mineItems,
					});
				}
				if(data3 && data3.result && data3.result.data && data3.result.data.length) { // 收藏的
					const collectedProducts = data3.result.data[0].collectedProducts;
					this.data.mineItems[1].num = collectedProducts.length;
					this.setData({
						mineItems: this.data.mineItems,
					});
				}
			}
		}).catch(e => {
			wx.hideLoading();
			wx.stopPullDownRefresh();
			wx.showToast({
        title: '服务繁忙，请稍后再试~',
        icon: 'none',
      });
		});
	},
	// 获取发布的数据
	getReleasedData() {
		wx.cloud.callFunction({
			name: 'getProductsData',
			data: {
				pageData: this.data.pageData,
				uid: this.data.openid,
				isSold: '0',
				isDeleted: '0',
			}
		}).then(data1 => {
			wx.hideLoading();
			const data = data1?.result?.data?.data || [];
			const total = data1?.result?.count?.total || 0;
			if(data.length > 0) { // 发布的商品
				data.map(item => {
					item.currentPrice = priceConversion(item.currentPrice);
					item.displayImg = item.img[0];
					item.isOwn = item.uid == this.data.openid ? '1' : '0';
					return item;
				});
				this.setData({
					productsList: [...this.data.productsList, ...data],
					postNum: total,
					showLoading: !!data.length,
				});
			} else {
				// 没有数据时也要更新页面，确保删除后列表被清空
				this.setData({
					productsList: this.data.productsList,
					postNum: total,
					showLoading: false,
				});
			}
		}).catch(e => {
			wx.hideLoading();
			this.setData({
				productsList: [],
				postNum: 0,
				showLoading: false,
			});
		});
	},
	// 获取卖出的数据
	getSoldData() {
		wx.cloud.callFunction({ // 卖出的
			name: 'getProductsData',
			data: {
				uid: this.data.openid,
				isSold: '1',
				isDeleted: '0',
			}
		}).then(data2 => {
			wx.hideLoading();
			if(data2 && data2.result && data2.result.count) { // 卖出的商品
				const total = data2.result.count.total;
				this.data.mineItems[0].num = total;
				this.setData({
					mineItems: this.data.mineItems,
				});
			}
		});
	},
	// 获取收藏的数据
	getCollectedData() {
		wx.cloud.callFunction({ // 收藏的
			name: 'getUserData',
			data: {
				uid: this.data.openid,
			}
		}).then(data3 => {
			wx.hideLoading();
			if(data3 && data3.result && data3.result.data && data3.result.data.length) {
				const collectedProducts = data3.result.data[0].collectedProducts;
				this.data.mineItems[1].num = collectedProducts.length;
				this.setData({
					mineItems: this.data.mineItems,
				});
			}
		});
	},
	// 新版：选择头像回调（open-type="chooseAvatar"）
	onChooseAvatar(e) {
		if (!this.data.openid) return;
		const avatarUrl = e.detail.avatarUrl;
		wx.setStorageSync('avatarUrl', avatarUrl);
		this.data.userInfo.avatarUrl = avatarUrl;
		this.setData({ userInfo: this.data.userInfo });
	},
	// 新版：昵称输入框失焦回调（type="nickname"）
	onNicknameInput(e) {
		if (!this.data.openid) return;
		const nickName = e.detail.value;
		if (!nickName) return;
		wx.setStorageSync('nickName', nickName);
		this.data.userInfo.nickName = nickName;
		this.setData({
			userInfo: this.data.userInfo,
			hasUserInfo: true,
		});
	},
	// 点击头像打开用户信息设置弹窗
	onAvatarTap() {
		if (!this.data.openid) {
			wx.showToast({
				title: '请先登录',
				icon: 'none',
			});
			return;
		}
		this.setData({
			showUserInfoModal: true,
			tempAvatarUrl: this.data.userInfo.avatarUrl || '',
			tempNickName: this.data.userInfo.nickName || '',
		});
	},
	// 关闭用户信息设置弹窗
	onCloseUserInfoModal() {
		this.setData({
			showUserInfoModal: false,
			tempAvatarUrl: '',
			tempNickName: '',
		});
	},
	// 弹窗中选择头像
	onChooseAvatarInModal(e) {
		const avatarUrl = e.detail.avatarUrl;
		this.setData({
			tempAvatarUrl: avatarUrl,
		});
	},
	// 弹窗中输入昵称
	onNickNameInputInModal(e) {
		this.setData({
			tempNickName: e.detail.value,
		});
	},
	// 保存用户信息
	async onSaveUserInfo() {
		const { tempAvatarUrl, tempNickName, openid } = this.data;
		if (!tempNickName.trim()) {
			wx.showToast({
				title: '请输入昵称',
				icon: 'none',
			});
			return;
		}
		wx.showLoading({ title: '保存中...' });
		try {
			// 上传到云存储获取永久链接
			let finalAvatarUrl = tempAvatarUrl;
			if (tempAvatarUrl && tempAvatarUrl.startsWith('wxfile://')) {
				const uploadRes = await wx.cloud.uploadFile({
					cloudPath: `avatar/${openid}/${Date.now()}.jpg`,
					filePath: tempAvatarUrl,
				});
				finalAvatarUrl = uploadRes.fileID;
			}
			// 保存到本地存储
			wx.setStorageSync('avatarUrl', finalAvatarUrl);
			wx.setStorageSync('nickName', tempNickName);
			// 更新页面数据
			this.setData({
				'userInfo.avatarUrl': finalAvatarUrl,
				'userInfo.nickName': tempNickName,
				hasUserInfo: true,
				showUserInfoModal: false,
			});
			// 同步到数据库
			await wx.cloud.callFunction({
				name: 'updateUserData',
				data: {
					openid: openid,
					avatarUrl: finalAvatarUrl,
					nickName: tempNickName,
				},
			});
			wx.showToast({
				title: '保存成功',
				icon: 'success',
			});
		} catch (e) {
			console.error('保存用户信息失败:', e);
			wx.showToast({
				title: '保存失败',
				icon: 'none',
			});
		} finally {
			wx.hideLoading();
		}
	},
	// 上传图片
	doUpload: function () {
		if(!this.data.openid) { // 未登录，提示登录
			wx.showModal({
				title: '未登录',
				content: '点击左侧登录按钮，登录后继续发布',
				showCancel: false,
				confirmText: '我知道了'
			});
			return;
		}
		wx.chooseMedia({ // 1 选择图片
			count: 9,
			mediaType: ['image'],
			sizeType: ['compressed'],
			sourceType: ['album', 'camera'],
			success: res => {
				const imgSecCheckArr = []; // 图片安全检查结果
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
				tempFiles.forEach((item) => { // 遍历临时文件数组，将每一个数据进行安全检查
					const size = item.size;
					const path = item.tempFilePath; // chooseMedia 用 tempFilePath
					if(size / 1024 / 1024 > 1) { // 图片大小超过1M，压缩后再进行安全检查
						wx.compressImage({ src: path, quality: 20 }).then(compressResult => {
							const handledPath = compressResult.tempFilePath;
							this.imgSecCheck(handledPath, imgSecCheckArr, tempFilesLength, () => { imgSecCheckCount++ ; return imgSecCheckCount; }, concurrencyCtrl);
						}).catch(err => {
							console.error('compressImage error:', err);
							imgSecCheckCount++;
						})
					} else { // 图片大小小于1M，直接进行安全检查
						this.imgSecCheck(path, imgSecCheckArr, tempFilesLength, () => { imgSecCheckCount++ ; return imgSecCheckCount; }, concurrencyCtrl);
					}
				});
			},
			fail: e => {
				// wx.showToast({
				// 	title: '未获取到有效图片，请再试一次',
				// 	icon: 'none'
				// });
			}
		})
	},
	// 图片安全检查（调用公共工具函数，带并发控制）
	imgSecCheck(filePath, imgSecCheckArr, tempFilesLength, getCount, concurrencyCtrl) {
		imgSecCheck(this, filePath, imgSecCheckArr, tempFilesLength, getCount, () => {
			this.data.tempFilePaths.forEach((item, tempFilePaths_index1) => {
				this.uploadImg(item, tempFilePaths_index1, tempFilesLength);
			});
		}, concurrencyCtrl);
	},
	// 将图片上传（调用公共工具函数）
	uploadImg(item, tempFilePaths_index1, tempFilesLength) {
		uploadImg(this, item, tempFilePaths_index1, tempFilesLength, 'me', () => {
			const params = {
				filePath: this.data.tempFilePaths,
				fileIdArr: this.data.fileIdArr,
				userInfo: this.data.userInfo,
			};
			wx.navigateTo({
				url: '../postProduct/postProduct',
				success: function(result) {
					result.eventChannel.emit('sendImage', params);
				},
			});
		});
	},
	// 下拉刷新列表
	onPullDownRefresh: function() {
		this.data.pageData.currentPage = 1;
		this.data.productsList = [];
		wx.showLoading();
		this.initData();
	},
  // 上滑加载更多
	productScroll: function() {
    if(this.data.showLoading) {
      this.data.pageData.currentPage += 1;
      this.getReleasedData();
    }
	},
	// 商品预览
	preview(e) {
		if(!e.currentTarget.dataset.item.isOff) { // 如果商品没有下架
			wx.navigateTo({
				url: '../productDetail/productDetail',
				success: function(res) {
					res.eventChannel.emit('toProductDetail', { _id: e.currentTarget.dataset.item._id, isOwn: e.currentTarget.dataset.item.isOwn });
				}
			});	
		} else { // 商品下架了
			this.data.currentDataId = e.currentTarget.dataset.item._id;
			wx.showActionSheet({
				itemList: ['编辑', '重新上架', '删除'],
				success: res => {
					if(res.tapIndex === 0) { // 编辑
						const params = JSON.stringify(e.currentTarget.dataset.item);
						wx.navigateTo({
							url: '../postProduct/postProduct?params=' + params,
						});
					} else if(res.tapIndex === 1) { // 重新上架
						wx.showModal({
							title: '',
							content: '确定重新上架吗？',
							success: res => {
								if(res.confirm) {
									wx.showLoading();
									wx.cloud.callFunction({
										name: 'updateProductsData',
										data: {
											uid: this.data.openid,
											_id: this.data.currentDataId,
											isOff: '0',
										},
										success: res => {
											wx.hideLoading();
											if(res && res.result && res.result.status && res.result.status == 200) {
												const data = res.result.data;
												this.data.productsList.forEach(item => {
													(item._id === data._id) && (item.isOff = data.isOff === '0' ? false : true);
												});
												this.setData({
													productsList: this.data.productsList,
												});
												wx.showToast({
													title: '已上架',
													icon: 'success',
												})
											}
										},
										fail: e => {
											wx.hideLoading();
											wx.showToast({
												title: '服务繁忙，请稍后再试~',
												icon: 'none'
											})
										}
									})
								}
							}
						})
					} else if(res.tapIndex === 2) { // 删除
						wx.showModal({
							title: '确定要删除吗？',
							content: '商品删除后不可恢复',
							confirmText: '删除',
							confirmColor: '#f00',
							success: res => {
								if(res.confirm) {
									wx.showLoading();
									wx.cloud.callFunction({
										name: 'updateProductsData',
										data: {
											uid: this.data.openid,
											_id: this.data.currentDataId,
											isDeleted: '1',
										},
										success: res => {
											wx.hideLoading();
											if(res && res.result && res.result.status && res.result.status == 200) {
												this.data.pageData.currentPage = 1;
												this.data.productsList = [];
												wx.showLoading();
												this.getReleasedData();
												wx.showToast({
													title: '删除成功',
													icon: 'success',
												});
											}
										},
										fail: e => {
											wx.hideLoading();
											wx.showToast({
												title: '服务繁忙，请稍后再试~',
												icon: 'none',
											})
										}
									})
								}
							}
						})
					}
				}
			})
		}
	},
	// 降价--按钮
	priceReduction(e) {
		if(!e.currentTarget.dataset.item.isOff) {
			this.data.currentDataId = e.currentTarget.dataset.item._id;
			this.setData({
				dialogImg: e.currentTarget.dataset.item.displayImg,
				currentPrice: e.currentTarget.dataset.item.currentPrice,
				dialogShow: true,
			});	
		} else {
			this.preview(e);
		}
	},
	// 降价--弹窗
	tapDialogButton(e) {
		if(e.detail.index) { // 确认
			if(+this.data.modifiedPrice >= 100000000 || +this.data.modifiedPrice <= 0) {
				this.setData({
					toptipsShow: true,
					resultText: '商品价格必须在0元与1亿元之间哦~',
					toptipsType: 'info',
				});
				return;
			}
			if(+this.data.modifiedPrice > +this.data.currentPrice) {
				this.setData({
					toptipsShow: true,
					resultText: '新的价格要小于原价格哦~',
					toptipsType: 'info',
				});
				return;
			}
			wx.cloud.callFunction({
				name: 'updateProductsData',
				data: {
					uid: this.data.openid,
					_id: this.data.currentDataId,
					currentPrice: +this.data.modifiedPrice,
				},
				success: res => {
					if(res && res.result && res.result.status && res.result.status == 200) {
						const data = res.result.data;
						this.data.productsList.map(item => {
							(item._id === data._id) && (item.currentPrice = data.currentPrice);
							return item;
						});
						this.setData({
							productsList: this.data.productsList,
						});
						wx.showToast({
							title: '已修改',
							icon: 'success',
						})
					} else {
						wx.showToast({
							title: '修改失败，请稍后再试...',
							icon: 'none',
						});
					}
				},
				fail: e => {
					wx.showToast({
						title: '修改失败，请稍后再试...',
						icon: 'none',
					});
				}
			})
		}
		this.setData({
			dialogShow: false,
			modifiedPrice: '',
		});
	},
	// 更多 -- 卖出 下架 删除
	more(e) {
		if(!e.currentTarget.dataset.item.isOff) {
			this.data.currentDataId = e.currentTarget.dataset.item._id;
			wx.showActionSheet({
				itemList: ['卖出', '下架', '删除'],
				success: (res) => {
					if(res.tapIndex === 0) { // 卖出
						wx.showModal({
							title: '宝贝已经卖出？',
							content: '卖出去的宝贝要及时确认哦~',
							cancelText: '还没有',
							confirmText: '卖出去啦',
							success: res => {
								if(res.confirm) {
									wx.cloud.callFunction({
										name: 'updateProductsData',
										data: {
											uid: this.data.openid,
											_id: this.data.currentDataId,
											isSold: '1',
										},
										success: res => {
											if(res && res.result && res.result.status && res.result.status == 200) {
												this.data.pageData.currentPage = 1;
												this.data.productsList = [];
												wx.showLoading();
												this.getReleasedData();
												this.getSoldData();
												wx.showToast({
													title: '恭喜~',
													icon: 'none',
												})
											}
										},
										fail: e => {
											wx.showToast({
												title: '服务繁忙，请稍后再试~',
												icon: 'none'
											})
										}
									})
								}
							}
						})
					} else if(res.tapIndex === 1) { // 下架
						wx.showModal({
							title: '确定要下架吗？',
							content: '商品下架后可以再次上架',
							success: res => {
								if(res.confirm) {
									wx.showLoading();
									wx.cloud.callFunction({
										name: 'updateProductsData',
										data: {
											uid: this.data.openid,
											_id: this.data.currentDataId,
											isOff: '1',
										},
										success: res => {
											wx.hideLoading();
											if(res && res.result && res.result.status && res.result.status == 200) {
												const data = res.result.data;
												this.data.productsList.forEach(item => {
													(item._id === data._id) && (item.isOff = data.isOff === '1');
												});
												this.setData({
													productsList: this.data.productsList,
												});
												wx.showToast({
													title: '下架成功',
													icon: 'success',
												})
											}
										},
										fail: e => {
											wx.hideLoading();
											wx.showToast({
												title: '服务繁忙，请稍后再试~',
												icon: 'none',
											})
										}
									})
								}
							}
						})
					} else if(res.tapIndex === 2) { // 删除
						wx.showModal({
							title: '确定要删除吗？',
							content: '商品删除后不可恢复',
							confirmColor: '#f00',
							success: (res) => {
								if(res.confirm) {
									wx.showLoading();
									wx.cloud.callFunction({
										name: 'updateProductsData',
										data: {
											uid: this.data.openid,
											_id: this.data.currentDataId,
											isDeleted: '1',
										},
										success: res => {
											wx.hideLoading();
											if(res && res.result && res.result.status && res.result.status == 200) {
												this.data.pageData.currentPage = 1;
												this.data.productsList = [];
												wx.showLoading();
												this.getReleasedData();
												wx.showToast({
													title: '删除成功',
													icon: 'success',
												});
											}
										},
										fail: e => {
											wx.hideLoading();
											wx.showToast({
												title: '服务繁忙，请稍后再试~',
												icon: 'none',
											})
										}
									})
								}
							}
						})
					}
				}
			})	
		} else {
			this.preview(e);
		}
	},
	// input -- 输入降价后的金额
	dialogInput(e) {
		if(+e.detail.value >= 100000000 || +e.detail.value <= 0) {
			this.setData({
				toptipsShow: true,
				resultText: '商品价格必须在0元与1亿元之间哦~',
				toptipsType: 'info',
			});
		}
		this.setData({
			modifiedPrice: money(e.detail.value)
		});
	},
	// 卖出 收藏
	toMineItemDetail: function(e) {
		const targetItem = e.currentTarget.dataset.item;
		if(targetItem.value === 0) { // 卖出
			wx.navigateTo({
				url: '../soldProducts/soldProducts',
			});
		} else if(targetItem.value === 1) { // 收藏
			wx.navigateTo({
				url: '../collectedProducts/collectedProducts',
			});
		}
	},
	// 问题反馈
	feedback() {
		wx.navigateTo({
			url: '../feedback/feedback',
		});
	},
	// 阻止事件冒泡
	stopPropagation() {
		// 什么都不做，只是阻止冒泡
	},
})