# 拾旧坊 - 项目架构文档

## 项目概述

**拾旧坊** 是一个社区二手交易微信小程序平台，旨在快速交易闲置物品，打造安全、高效的二手交易生态圈。

- **类型**: 原生微信小程序（非 Taro/uni-app）
- **后端**: 腾讯云 CloudBase（微信云开发），全 Serverless 架构
- **AppID**: wx55fc31983d95bce8
- **云环境**: cloud1-1gdhscygd67ee3f4

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | 原生微信小程序 | 使用 Page/Component API，无三方框架封装 |
| UI 组件库 | weui-miniprogram ^1.0.7 | 微信官方 WeUI 组件库 |
| 后端运行时 | 微信云开发 Cloud Functions | Node.js Serverless 函数，共 23 个 |
| 数据库 | 微信云数据库 | MongoDB 风格的文档数据库，支持 Geo 查询 |
| 文件存储 | 微信云存储 | 图片上传与 CDN 分发 |
| 实时通信 | 云数据库 .watch() | 数据库变动监听实现实时聊天 |
| 地图服务 | 腾讯地图 QQ SDK | 逆地理编码、POI 查询 |
| 日期处理 | dayjs ^1.10.5 | 轻量日期格式化 |
| CI/CD | miniprogram-ci ^2.1.31 | 自动化上传/预览 |

## 目录结构

```
thriftlane_mp/
├── miniprogram/                  # 小程序前端源代码（miniprogramRoot）
│   ├── app.js                    # 应用入口：云开发初始化、用户登录
│   ├── app.json                  # 应用配置：页面注册、tabBar、窗口样式、权限
│   ├── app.wxss                  # 全局样式（WeUI 导入、iconfont 导入）
│   ├── sitemap.json              # 微信搜索索引配置
│   ├── pages/                    # 所有页面
│   │   ├── homePage/             # 首页：商品流、Banner、位置筛选、无限滚动
│   │   ├── productDetail/        # 商品详情页
│   │   ├── search/               # 搜索页：热门搜索、历史搜索
│   │   ├── postProduct/          # 发布/编辑商品页
│   │   ├── message/              # 消息列表页（会话列表）
│   │   ├── im/room/              # 实时聊天室（买家-卖家 1v1 对话）
│   │   ├── me/                   # 个人中心：用户信息、我的商品
│   │   ├── soldProducts/         # 已售出商品列表
│   │   ├── collectedProducts/    # 收藏商品列表
│   │   └── feedback/            # 用户反馈页
│   ├── components/
│   │   └── chatroom/             # 可复用聊天室组件（实时消息监听）
│   ├── custom-tab-bar/           # 自定义底部标签栏（首页/消息/我的）
│   ├── utils/                    # 工具函数
│   │   ├── config.js             # 配置项（腾讯地图 Key 等）
│   │   ├── productUtils.js       # 商品相关逻辑（热度计算、价格格式化、图片安全检查、图片上传）
│   │   ├── timeFormatter.js      # 时间格式化（基于 dayjs）
│   │   ├── priceConversion.js    # 价格格式化
│   │   ├── moneyInputLimit.js    # 金额输入校验（保留两位小数）
│   │   ├── phoneType.js          # iPhone X 刘海屏适配
│   │   ├── checkNetworkStatus.js # 网络状态监控
│   │   └── qqmap-wx-jssdk.js    # 腾讯地图 SDK
│   ├── style/
│   │   └── iconfont.wxss        # 图标字体样式
│   └── images/                   # 静态图片资源
├── cloudfunctions/               # 云函数（后端逻辑，共 23 个）
├── node_modules/                 # 前端 npm 依赖
├── project.config.json           # 微信开发者工具项目配置
├── project.private.config.json   # 本地开发者私有配置（gitignore）
├── deploy_cloudfunctions.sh      # 批量部署云函数脚本
├── package.json                  # 根 npm 配置（miniprogram-ci 等构建工具）
└── README.md                     # 项目说明
```

## 整体架构

```
                        ┌──────────────────────────────┐
                        │     微信小程序客户端            │
                        │  (原生 Page/Component API)      │
                        └────────────┬─────────────────┘
                                     │ wx.cloud.callFunction()
                                     ▼
                        ┌──────────────────────────────┐
                        │      微信云开发平台              │
                        │                               │
                        │  ┌───────────────────────┐   │
                        │  │   Cloud Functions      │   │
                        │  │   (23 个 Node.js 函数)   │   │
                        │  └──────────┬────────────┘   │
                        │             │                 │
                        │  ┌──────────┴────────────┐   │
                        │  │     Cloud Database     │   │
                        │  │  (文档数据库，支持Geo)   │   │
                        │  └───────────────────────┘   │
                        │                               │
                        │  ┌───────────────────────┐   │
                        │  │     Cloud Storage      │   │
                        │  │  (图片文件存储/CDN)      │   │
                        │  └───────────────────────┘   │
                        └──────────────────────────────┘
```

## 核心数据流

### 1. 应用启动流程
```
用户打开小程序
  → app.js: wx.cloud.init() 初始化云开发
  → 调用 login 云函数获取 openid
  → 存储到 app.globalData
  → 跳转首页
```

### 2. 首页商品加载
```
homePage
  → 获取用户定位（腾讯地图 SDK 逆地理编码）
  → 调用 getProductsData 云函数（支持 Geo 近邻查询）
  → 云数据库 data_products 集合返回商品列表
  → 分页加载（下拉刷新 + 上拉无限滚动）
```

### 3. 发布商品流程
```
postProduct 页面
  → 选择图片 → 上传至云存储
  → 图片安全检查（imgSecCheck 云函数，调用微信内容安全 API）
  → 文本安全检查（msgSecCheck 云函数）
  → 调用 postProduct 云函数写入 data_products 集合
```

### 4. 实时聊天流程
```
买家点击「联系卖家」
  → 进入 im/room 聊天页面
  → chatroom 组件初始化
  → 数据库 .watch() 监听 data_chat 集合变动
  → 发送消息调用 addMessageData 云函数
  → 同时更新 data_message 集合（会话列表）
  → 对方实时收到推送
```

### 5. 用户信息流
```
me 页面
  → getUserData 云函数获取用户数据（data_user 集合）
  → getProductsData 按 owner 查询我的商品（data_products 集合）
  → 支持修改价格、下架、删除
  → updateProductsData 云函数更新商品状态
```

## 数据库集合设计

| 集合名称 | 用途 |
|----------|------|
| data_products | 商品数据（标题、描述、价格、图片、位置、状态、热度） |
| data_message | 会话列表（买卖双方最后一条消息摘要） |
| data_chat | 聊天消息记录 |
| data_feedback | 用户反馈 |
| data_user | 用户数据（头像、昵称、openid） |

## 状态管理

项目未使用 Redux/MobX 等正式状态管理库，采用以下方式：

- **app.globalData** — 全局共享数据（openid、用户位置、iPhoneX 适配标志）
- **Page.data + this.setData()** — 页面级响应式数据绑定
- **wx.Storage** — 本地持久化（搜索历史、用户头像/昵称缓存）
- **跨页面通信**：
  - `eventChannel` (getOpenerEventChannel) — 页面间事件传递
  - `getCurrentPages()` — 获取前一个页面实例直接操作

## 构建与部署

- **开发调试**: 微信开发者工具直接编译运行，支持热重载
- **npm 构建**: 开发者工具内置 npm 构建，输出到 miniprogram/miniprogram_npm/
- **云函数部署**: `deploy_cloudfunctions.sh` 脚本批量部署所有云函数
- **CI 上传**: 通过 miniprogram-ci 实现自动化上传/预览

## 云函数列表（23 个）

云函数位于 `cloudfunctions/` 目录，每个函数独立存在，按需调用：
- 用户相关：login, getUserData
- 商品相关：getProductsData, getProductsInfoData, postProduct, updateProductsData, removeProductsData
- 消息相关：getMessageData, addMessageData, removeMessageData
- 搜索相关：search
- 反馈相关：getFeedbackData, addFeedbackData
- 安全相关：imgSecCheck（图片审核）, msgSecCheck（文本审核）
