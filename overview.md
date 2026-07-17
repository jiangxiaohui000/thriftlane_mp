# 拾旧坊代码修复概览

## 总览
2026-07-17 完成全部上报问题的代码级修复，涉及 **14 个文件** 的修改/新增、**3 个空目录** 的清理、**1 个 CI 部署脚本** 的新增。

## 修复清单

### 🔴 P0（上架阻断 + 线上故障）
| 问题 | 修复范围 |
|------|---------|
| **隐私合规完全缺失** | `utils/privacy.js`（新增）+ `app.js` 接入 |
| **编辑商品崩溃+丢图** | `postProduct.js`（userInfo兜底+toEdit传fileIdArr+deleteImg同步）+ `productDetail.js` edit() 加透传 |
| **首页分页加载失效** | `homePage.js`（拆 hasMore）、`homePage.wxml`（底部逻辑）|
| **地图域名未白名单** | 代码无法修 → 已注明需手动加 `apis.map.qq.com` |

### 🟡 P1（线上风险 + 可维护性）
| 问题 | 修复 |
|------|------|
| **位置自动调用** | `homePage.js`/`postProduct.js` 移除 onLoad 自动 getLocation，改用户手势触发 |
| **app.js 缺 env** | 显式指定 `cloud1-1gdhscygd67ee3f4` |
| **room.js env 写死旧值** | `chatRoomEnvId`: `'xiaoyuanbao'` → `'cloud1-1gdhscygd67ee3f4'`（严重 bug，之前聊天室数据库全查错环境）|
| **部署脚本硬编码** | `deploy_cloudfunctions.sh` 路径参数化 + 新增 `scripts/deploy_ci.js`（miniprogram-ci）|

### 🔵 P2（代码整洁）
| 问题 | 修复 |
|------|------|
| 3 个空云函数 | 删除 `getChatsData`/`getPhoneNumber`/`openapi` |
| `clearUnreadCount` 缺 config.json | 新增 |
| `chatroom.js` 调试日志 | 移除 2 处 `console.info` |
| 图片大小提示不一致 | `postProduct.js`/`me.js` 阈值 3→5MB |
| `useQQMap` 无判空 | `postProduct.js` 加 `formatted_addresses` 保护 |
| `projectname` 仍为"校园宝" | 改为"拾旧坊" |

## 仍需人工处理
1. **域名白名单**：MP 后台 → request合法域名 → 加 `https://apis.map.qq.com`
2. **个人主体类目**：确认"二手交易"类目对个人开发者开放，或调整类目
3. **隐私政策**：MP 后台「设置 → 服务内容 → 用户隐私保护指引」填写政策文本
