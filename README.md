# 拾旧坊 ThriftLane

一个基于社区属性的二手交易平台，选择你所在的小区、学校，看看有没有心仪的~。

## 功能特性

- **位置感知** — 基于腾讯地图定位，发现身边的二手好物
- **商品发布** — 多图上传，内容安全审核（图片+文本）
- **实时聊天** — 买卖双方 1v1 即时通讯
- **智能搜索** — 关键词搜索 + 热门搜索推荐
- **个人中心** — 管理我的商品、收藏、已售记录
- **反馈系统** — 用户意见反馈收集

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生微信小程序 + WeUI 组件库 |
| 后端 | 微信云开发 Cloud Functions（Serverless） |
| 数据库 | 微信云数据库（文档型，支持 Geo 查询） |
| 存储 | 微信云存储（图片 CDN） |
| 实时通信 | 云数据库 `.watch()` 监听 |
| 地图 | 腾讯地图 QQ SDK |
| 日期 | dayjs |

## 快速开始

### 环境要求

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) ≥ 1.06
- 微信小程序 AppID（在 `project.config.json` 中配置）
- 微信云开发环境（在 `app.js` 中配置环境 ID）

### 本地开发

```bash
# 1. 克隆项目
git clone <repo-url> thriftlane_mp
cd thriftlane_mp

# 2. 安装根依赖（miniprogram-ci 等构建工具）
npm install

# 3. 安装小程序前端依赖
cd miniprogram
npm install

# 4. 用微信开发者工具打开项目根目录
#    - 选择项目 thriftlane_mp
#    - 工具 → 构建 npm（生成 miniprogram_npm）
#    - 点击「编译」即可预览
```

### 云函数部署

```bash
# 批量部署所有云函数到云环境
bash deploy_cloudfunctions.sh
```

## 项目结构

```
thriftlane_mp/
├── miniprogram/              # 小程序前端源代码
│   ├── pages/                # 页面
│   │   ├── homePage/         # 首页（商品流）
│   │   ├── productDetail/    # 商品详情
│   │   ├── search/           # 搜索
│   │   ├── postProduct/      # 发布商品
│   │   ├── message/          # 消息列表
│   │   ├── im/room/          # 聊天室
│   │   ├── me/               # 个人中心
│   │   ├── soldProducts/     # 已售商品
│   │   ├── collectedProducts/# 收藏商品
│   │   └── feedback/         # 反馈
│   ├── components/           # 公共组件
│   ├── custom-tab-bar/       # 自定义 TabBar
│   ├── utils/                # 工具函数
│   └── images/               # 图片资源
├── cloudfunctions/           # 云函数（23 个）
├── project.config.json       # 微信开发者工具配置
└── deploy_cloudfunctions.sh  # 云函数部署脚本
```

## 架构说明

详细架构文档见 [AGENT.md](./AGENT.md)。
