#!/usr/bin/env bash
# ==============================================================================
# HermesOps - 远程一键注入安装脚本 (v5.0.0)
# ==============================================================================

set -e

REPO_URL="https://github.com/Jessy-Huang/HermesOps.git"

RED='\033[0;91m'
GREEN='\033[0;92m'
YELLOW='\033[1;93m'
BLUE='\033[0;94m'
WHITE='\033[1;97m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}    🚀 正在通过网络一键部署 HermesOps 协同研发平台...${NC}"
echo -e "${BLUE}======================================================${NC}"

TARGET_DIR="$HOME/.hermesops"
BIN_LINK_DIR="/usr/local/bin"

# 1. 基础环境自检
if ! command -v git &>/dev/null; then
    echo -e "${RED}❌ 错误: 未检测到 Git 环境。${NC}"
    exit 1
fi

# 2. 物理落盘与备份
echo -e "\n${BLUE}[1/2] 📥 正在从远程仓库拉取核心代码矩阵...${NC}"
if [ -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}⚠ 检测到历史版本，已自动备份至 ${TARGET_DIR}.bak${NC}"
    rm -rf "${TARGET_DIR}.bak"
    mv "$TARGET_DIR" "${TARGET_DIR}.bak"
fi

git clone --depth 1 "$REPO_URL" "$TARGET_DIR"

# 强制修正可执行权限
chmod +x "$TARGET_DIR/bin/hermesops"
chmod +x "$TARGET_DIR/core/"*.sh 2>/dev/null || true

# 3. 全局穿透软链接
echo -e "\n${BLUE}[2/2] 🚀 正在打通全局命令行作用域...${NC}"
LINK_SUCCESS=false

if [ -w "$BIN_LINK_DIR" ]; then
    ln -sf "$TARGET_DIR/bin/hermesops" "$BIN_LINK_DIR/hermesops"
    LINK_SUCCESS=true
else
    if sudo ln -sf "$TARGET_DIR/bin/hermesops" "$BIN_LINK_DIR/hermesops" 2>/dev/null; then
        LINK_SUCCESS=true
    fi
fi

if [ "$LINK_SUCCESS" = false ]; then
    SHELL_RC=[[ "$SHELL" == */zsh ]] && echo "$HOME/.zshrc" || echo "$HOME/.bashrc"
    if ! grep -q "hermesops/bin" "$SHELL_RC"; then
        echo -e "\nexport PATH=\"\$PATH:$TARGET_DIR/bin\"" >> "$SHELL_RC"
    fi
    echo -e "${YELLOW}💡 已将环境注入 $SHELL_RC，请执行 'source $SHELL_RC' 激活！${NC}"
fi

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN} ✅ HermesOps 矩阵内核全球网络部署圆满成功！${NC}"
echo -e " 💡 直接在终端输入即可调出面板: ${WHITE}hermesops${NC}"
echo -e "${GREEN}======================================================${NC}\n"
