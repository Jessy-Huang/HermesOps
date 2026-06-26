#!/usr/bin/env bash
# ==============================================================================
# HermesOps - 环境与路径修复模块 (env.sh)
# ==============================================================================

# 操作系统检测
detect_os() {
    case "$(uname -s)" in
        Linux*)   OS="Linux" ;;
        Darwin*)  OS="macOS" ;;
        CYGWIN*|MINGW*|MSYS*) OS="Windows" ;;
        *)        OS="Unknown" ;;
    esac
}

# 修复 PATH
fix_path() {
    export PATH="$HOME/.local/bin:$PATH"
    export PATH="$HOME/.qoder/bin/qodercli:$PATH"
    export PATH="$HOME/.qwen/bin:$PATH"
    export PATH="$HOME/.nvm/versions/node/*/bin:$PATH"
    export PATH="/usr/local/bin:$PATH"
    export PATH="$HOME/.npm-global/bin:$PATH"
    export PATH="$HOME/.hermes/bin:$PATH"
}

# 加载 nvm
load_nvm() {
    export NVM_DIR="$HOME/.nvm"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        \. "$NVM_DIR/nvm.sh" 2>/dev/null
        return 0
    fi
    return 1
}

# Node.js 版本管理
ensure_node_20() {
    if ! command -v node &> /dev/null; then
        return 1
    fi
    
    local current_version=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [[ $current_version -ge 20 ]]; then
        return 0
    fi
    
    if ! load_nvm; then
        return 1
    fi
    
    if ! nvm list 2>/dev/null | grep -q "v20"; then
        nvm install 20 >/dev/null 2>&1
    fi
    
    nvm use 20 &>/dev/null || return 1
    fix_path
    return 0
}

# 自动初始化执行
detect_os
fix_path