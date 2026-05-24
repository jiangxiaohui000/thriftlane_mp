#!/bin/zsh
# 云函数批量部署脚本
# 原理：CLI 打包时遇到 node_modules 目录会报 EISDIR，临时移走即可
# 云端会根据 package.json 自动安装依赖（wx-server-sdk 等）

set -e

ENV="cloud1-1gdhscygd67ee3f4"
PROJECT="/Users/jiangxiaohui/Documents/thriftlane_mp"
CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
CF_DIR="$PROJECT/cloudfunctions"
BACKUP_DIR="/tmp/cloudfunctions_nm_backup_$(date +%s)"

FUNCTIONS=(
  addMessageData addUserData authorizationRevoke feedback
  getMessageData getProductsData getProductsInfoData getUserData
  imgSecCheck login msgSecCheck openapi postProduct
  removeChatsData removeMessageData search searchHotKey
  updateProductsData updateUserData
)

echo "=== 云函数部署脚本 ==="
echo "环境: $ENV"
echo "函数数量: ${#FUNCTIONS[@]}"
echo ""

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

deploy_batch addMessageData addUserData authorizationRevoke feedback
deploy_batch getMessageData getProductsData getProductsInfoData getUserData imgSecCheck login
deploy_batch msgSecCheck openapi postProduct removeChatsData removeMessageData search searchHotKey updateProductsData updateUserData

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
