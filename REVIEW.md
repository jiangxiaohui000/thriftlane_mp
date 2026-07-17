# 拾旧坊（ThriftLane）小程序代码与上架审查报告

> 审查时间：2026-07-17｜审查范围：前端代码、云函数、配置、部署脚本
> 整体结论：**代码主体可用、包体达标（主包 1.0MB），但存在 1 个上架必拒项（隐私合规）、1 个线上调用必失败项（地图域名白名单）、2 个确定性功能 Bug（编辑商品崩溃+丢图、首页分页失效）。**

---

## 🔴 一、上架 / 合规问题（不修会上不了架或线上故障）

### 1. 隐私合规完全缺失（最关键，必拒/必崩）
- 现状：`app.json` 声明了 `requiredPrivateInfos: ["getLocation","chooseLocation"]` 并使用 `wx.getLocation` / `wx.chooseLocation`，但全项目**没有任何隐私协议处理代码**（`wx.requirePrivacyAuthorize` / `wx.getPrivacySetting` / `wx.onNeedPrivacyAuthorize` 均未调用），也没有隐私政策页。
- 后果：
  - **审核必拒**：微信自 2023-08 起强制要求——在控制台填写《隐私保护指引》、声明"地理位置"接口用途、且运行时引导用户同意后才能调用隐私接口。
  - **线上必崩**：未同意隐私协议的用户调用 `getLocation` 会直接返回 `fail: privacy permission is not authorized`，首页定位、发布页定位全部失效。
- 修复：
  1. 控制台填写隐私政策（可托管到云存储或自有域名），并在"用户隐私保护指引"勾选"地理位置"。
  2. `app.js` 或首页 `onLaunch` 接入隐私弹窗：
     ```js
     wx.onNeedPrivacyAuthorize(resolve => {
       // 展示自定义隐私弹窗，用户点同意后：
       resolve({ event: 'agree', resolve: true })
     })
     ```
  3. 仅在用户**主动点击**（如首页定位图标）时调用 `getLocation`，不要在一进 `onLoad` 就自动调（见问题 4）。

### 2. 地图域名未加白名单（线上必失败）
- 现状：`utils/qqmap-wx-jssdk.js` 内部通过 `wx.request` 请求 `https://apis.map.qq.com/...`；`project.config.json` 中 `urlCheck: true`（生产校验域名）。
- 后果：开发者工具勾选"不校验合法域名"时能跑，**真机/审核环境会全部失败**，逆地理编码（取小区名）失效，首页 `locationText` 永远"定位中"。
- 修复：在 MP 后台「开发管理 → 开发设置 → 服务器域名 → request合法域名」添加 `https://apis.map.qq.com`（需 ICP 备案域名，腾讯地图官方域名可直接加）。

### 3. 个人主体类目风险（上架前必须确认）
- 现状：项目为**个人开发者**主体，业务是"二手交易/社区闲置"。
- 风险：微信对"电商/二手交易"类目通常要求**企业主体 + 营业执照等资质**；个人主体可能无法通过该类目审核，或被要求补充《增值电信业务经营许可证》等材料。
- 建议：提前在 MP 后台确认所选类目对个人主体是否开放；若受限，需变更为主体为企业，或调整类目表述为"信息发布/社区"规避交易属性。

### 4. 位置授权触发时机
- 现状：`homePage.js` 在 `onLoad` 里"不管是否已授权，直接调 `wx.getLocation`"（代码注释原话）。
- 问题：未经用户手势触发 + 未做隐私前置，既不符合隐私规范，也容易被审核判定为"诱导/强制获取位置"。
- 建议：进入页面只展示"定位中"，等用户点击定位图标（已实现的 `goLocationPage`）再请求位置并走隐私授权。

---

## 🔴 二、确定性功能 Bug（会崩溃 / 功能失效）

### 5. 编辑商品必崩 + 图片丢失（高危）
- 复现路径：`productDetail` → `edit()` → 打开 `postProduct`（仅 emit `toEdit`，**不传 userInfo**）。
- Bug A（崩溃）：`releaseProduct()` 第 303-304 行读取 `this.data.userInfo.avatarUrl` / `.nickName`，但编辑流程下 `userInfo` 初始为 `''`（空字符串）→ `''.avatarUrl` 抛 `TypeError`，发布直接崩。
- Bug B（丢图）：发布时 `imageList` 取的是 `this.data.fileIdArr`（第 296 行），但编辑流程不会重新上传图片，`fileIdArr` 始终为 `[]` → **编辑后商品图片全部丢失**。
- 修复：编辑流程应把原商品的 `avatarUrl/nickName/fileId` 一并通过 `toEdit` 传入并写入 `fileIdArr`；`releaseProduct` 访问 `userInfo` 前做判空，缺失时用 `app.globalData` 兜底。

### 6. 首页分页加载失效（商品流只显示第一页）
- 现状：`homePage.js` 中 `showLoading` 被同时用作"加载态"和"是否还能加载更多"的开关。
  - `initData` 成功且有数据时：`showLoading: !!!data.length` → **有数据则为 `false`**。
  - `onReachBottom` 判断：`if(this.data.showLoading){ currentPage++; initData() }`。
- 后果：首屏有数据后 `showLoading=false`，触底后**不会再加载第 2 页及以后**，无限滚动等于失效，商品流最多看 20 条。
- 修复：拆成两个变量（如 `loading` 与 `hasMore`），分页用 `hasMore = data.length === pageSize` 控制。

### 7. `postProduct.useQQMap` 潜在崩溃
- 第 428 行 `res.result.formatted_addresses.recommend` 未判空，当地图返回无 `formatted_addresses` 时抛异常（虽被 `fail` 吞掉，但 `success` 内未保护）。

---

## 🟡 三、代码质量问题

| # | 位置 | 问题 | 影响 |
|---|------|------|------|
| 8 | `homePage.js:88` | `showLoading: !!!data.length` 三重取反，等价于 `!data.length`，可读性差且易误改 | 低 |
| 9 | `postProduct.js:146-153` | 图片大小判断 `> 3MB` 但提示文案写"不得超过 5MB" | 低（文案不一致） |
| 10 | `postProduct.js` 图片上传 | 多批添加图片时 `imageList` 会混入重复临时路径（显示层偶发重图） | 中 |
| 11 | `homePage.js:83` | `item.isOwn` 依赖 `app.globalData.openid`，但 openid 为异步获取，首屏渲染可能 `isOwn` 判断错误 | 低 |
| 12 | `chatroom.js:87,108` | 残留 `console.info` 调试日志，生产环境应移除 | 低（性能/整洁） |
| 13 | 全局 | `wx.cloud.callFunction` 混用 `success/fail` 回调与 `.then()` 两种风格 | 低（不一致） |
| 14 | `app.js:8` | `wx.cloud.init({ traceUser:true })` **未指定 env** | 中（多变体/多环境时行为不确定，见问题 16） |

---

## 🟡 四、发版 / 部署问题

### 15. 部署脚本硬编码（无法 CI / 换机即废）
- `deploy_cloudfunctions.sh` 写死了 `ENV`、`PROJECT=/Users/jiangxiaohui/...`、`CLI=/Applications/wechatwebdevtools.app/...`。
- 依赖微信开发者工具 GUI 的 `cli` 命令（需本机装了 DevTools），且用"临时移走 node_modules 再恢复"的 hack。
- 建议：改用已在 `devDependencies` 中的 `miniprogram-ci`（支持命令行上传代码 + 部署云函数，适合 CI）；路径改为参数/环境变量。

### 16. `wx.cloud.init` 未指定 env
- 前端 `app.js` 未设 `env`；`room.wxml` 传 `envId="{{chatRoomEnvId}}"`，需确认 `room.js` 已赋值（当前数据里未见该字段声明）。云函数侧已正确使用 `cloud.DYNAMIC_CURRENT_ENV`（✅ 正确）。
- 建议：`app.js` 显式 `wx.cloud.init({ env: 'cloud1-1gdhscygd67ee3f4', traceUser: true })`，并确认 `room.js` 显式传入同一 envId。

### 17. 死代码 / 空云函数
- `cloudfunctions/getChatsData`、`getPhoneNumber`、`openapi` 三个目录**为空（无 index.js）**，前端也未调用，且不在部署列表里。属废弃残留，建议删除，避免混淆。

### 18. `clearUnreadCount` 缺 `config.json`
- 其余云函数都有 `config.json`，它缺失（不影响 `callFunction`，但配置不一致）。

### 19. `projectname` 仍是"校园宝"
- `project.config.json` 里 `projectname: "%E6%A0%A1%E5%9B%AD%E5%AE%9D"`（校园宝 URL 编码），与品牌"拾旧坊"不一致——本地工程名，不影响线上，但说明改名不彻底。

### 20. 地图 Key 暴露在客户端
- `utils/config.js` 硬编码 `QQ_MAP_KEY`。地图 SDK Key 本就设计在客户端使用，但建议在腾讯位置服务控制台将该 Key **绑定到本 AppID + 启用请求配额/域名限制**，降低被盗刷风险。

---

## ✅ 五、做得好的地方（保留）

- **包体达标**：主包 1.0MB（JS 196K / WXML 60K / WXSS 72K / 图片 404K），远小于 2MB 上限。
- **内容安全到位**：UGC 文本走 `msgSecCheck`、图片走 `imgSecCheck`，且云函数 `config.json` 已正确声明 `security.msgSecCheck` / `security.imgSecCheck` 权限——这是二手交易类目**审核必需**项，已具备。
- **云函数 env 规范**：云函数统一用 `cloud.DYNAMIC_CURRENT_ENV`，正确。
- **聊天实时性**：`chatroom` 组件用 `db.watch()` 监听消息，重连/容错（`FATAL_REBUILD_TOLERANCE`）逻辑较完整。
- **并发控制**：图片安全检查做了最多 3 并发的队列控制，细节到位。

---

## 🎯 六、修复优先级清单

**P0（上架阻断 / 线上故障，必须先修）**
1. 接入隐私合规（隐私政策 + 隐私弹窗 + 接口声明）— 问题 1
2. 添加 `apis.map.qq.com` 到 request 合法域名 — 问题 2
3. 修复编辑商品崩溃 + 丢图 — 问题 5
4. 修复首页分页加载失效 — 问题 6

**P1（上线前建议修）**
5. 位置授权改为用户手势触发 + 隐私前置 — 问题 4/14
6. `app.js` / `room.js` 显式指定云环境 env — 问题 16
7. 部署脚本改用 `miniprogram-ci` 去硬编码 — 问题 15
8. 确认个人主体类目可行性 — 问题 3

**P2（代码整洁）**
9. 删除空云函数、补 `config.json`、移除 `console.info`、拆分 `showLoading` 语义、统一 callFunction 写法。
