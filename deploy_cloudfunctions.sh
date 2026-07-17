#!/bin/zsh
# 云函数批量部署脚本（v2 — 去硬编码，支持环境变量覆盖）
#
# 用法:
#   export CLOUD_ENV='cloud1-1gdhscygd67ee3f4'   # 可选，默认即此值
#   export WECHAT_CLI='/Applications/wechatwebdevtools.app/Contents/MacOS/cli'  # 可选
#   bash deploy_cloudfunctions.sh
#
# 原理：CLI 打包时遇到 node_modules 目录会报 EISDIR，临时移走即可
# 云端会根据 package.json 自动安装依赖（wx-server-sdk 等）

set -e

# === 可配置项（可通过环境变量覆盖）===
ENV="${CLOUD_ENV:-cloud1-1gdhscygd67ee3f4}"
PROJECT="${PROJECT_PATH:-$(cd "$(dirname "$0")" && pwd)}"
CLI="${WECHAT_CLI:-/Applications/wechatwebdevtools.app/Contents/MacOS/cli}"
BACKUP_DIR="/tmp/cloudfunctions_nm_backup_$(date +%s)"

CF_DIR="$PROJECT/cloudfunctions"

FUNCTIONS=(
  addMessageData addUserData authorizationRevoke clearUnreadCount feedback
  getMessageData getProductsData getProductsInfoData getUserData
  imgSecCheck login msgSecCheck postProduct
  removeChatsData removeMessageData search searchHotKey
  updateProductsData updateUserData
)

echo "=== 云函数部署脚本 ==="
echo "环境: $ENV"
echo "工程: $PROJECT"
echo "CLI:  $CLI"
echo "函数数量: ${#FUNCTIONS[@]}"
echo ""

# 检查 CLI 是否存在
if [ ! -f "$CLI" ]; then
  echo "错误: 未找到微信开发者工具 CLI，请确认路径或设置 WECHAT_CLI 环境变量"
  echo "  export WECHAT_CLI='/Applications/wechatwebdevtools.app/Contents/MacOS/cli'"
  exit 1
fi

# 备份所有 node_modules
mkdir -p "$BACKUP_DIR"
echo "--- 步骤1: 备份 node_modules ---"
for fn in "${FUNCTIONS[@]}"; do
  if [ -d "$CF_DIR/$fn/node_modules" ]; then
    mv "$CF_DIR/$fn/node_modules" "$BACKUP_DIR/${fn}_nm"
    echo "✓ 已备份 $fn/node_modules"
  fi
done

# 部署（分批避免并发冲突）
echo ""
echo "--- 步骤2: 部署云函数 ---"

deploy_batch() {
  local names=("$@")
  $CLI cloud functions deploy \
    --env "$ENV" \
    --project "$PROJECT" \
    --names "${names[@]}" \
    2>&1
  sleep 3
}

deploy_batch addMessageData addUserData authorizationRevoke clearUnreadCount feedback
deploy_batch getMessageData getProductsData getProductsInfoData getUserData imgSecCheck login
deploy_batch msgSecCheck postProduct removeChatsData removeMessageData search searchHotKey updateProductsData updateUserData

# 恢复 node_modules
echo ""
echo "--- 步骤3: 恢复 node_modules ---"
for fn in "${FUNCTIONS[@]}"; do
  if [ -d "$BACKUP_DIR/${fn}_nm" ]; then
    mv "$BACKUP_DIR/${fn}_nm" "$CF_DIR/$fn/node_modules"
    echo "✓ 已恢复 $fn/node_modules"
  fi
done

echo ""
echo "=== 部署完成 ==="
echo ""
echo "提示：如需接入 CI/CD，推荐改用 miniprogram-ci（已装为 devDependency）。"
echo "  参考 scripts/deploy_ci.js 脚本，使用方法："
echo "    export PRIVATE_KEY_PATH='/path/to/private.key'"
echo "    node scripts/deploy_ci.js"
