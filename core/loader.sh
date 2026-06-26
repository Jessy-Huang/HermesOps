#!/usr/bin/env bash
# ==============================================================================
# HermesOps - 动态插件注册内核 (v4.0.5 - 强广播版)
# ==============================================================================

export PLUGINS_DIR="$HOME/.hermesops/core/plugins"
declare -g -a PLUGINS_KEYS=()

declare -g -A P_NAME P_TYPE P_CMD P_INSTALL P_RUN P_PROS P_CONS P_QUOTA

register_plugins() {
    mkdir -p "$PLUGINS_DIR"
    PLUGINS_KEYS=()
    
    local plugin_file
    for plugin_file in $(ls "$PLUGINS_DIR"/*.sh 2>/dev/null | sort); do
        [ -f "$plugin_file" ] || continue
        
        local p_id=$(basename "$plugin_file" .sh)
        local _name="" _type="" _cmd="" _install="" _run="" _pros="" _cons="" _quota=""
        
        source "$plugin_file"
        
        PLUGINS_KEYS+=("$p_id")
        P_NAME["$p_id"]="$_name"
        P_TYPE["$p_id"]="$_type"
        P_CMD["$p_id"]="$_cmd"
        P_INSTALL["$p_id"]="$_install"
        P_RUN["$p_id"]="$_run"
        P_PROS["$p_id"]="$_pros"
        P_CONS["$p_id"]="$_cons"
        P_QUOTA["$p_id"]="$_quota"
    done
}

check_plugin_status() {
    local p_id=$1
    local name="${P_NAME[$p_id]}"
    local cmd="${P_CMD[$p_id]}"
    
    if [[ "$name" == "GitHub_Copilot" ]] || [[ "$name" == "CodeGeeX" ]]; then return 1; fi
    if [[ "$name" == "TRAE_SOLO" ]]; then
        if [[ "$OS" == "macOS" ]] && [[ -d "/Applications/Trae.app" ]]; then return 0; fi
        if command -v "trae" &> /dev/null; then return 0; fi
        return 1
    fi
    
    if command -v "$cmd" &> /dev/null || which "$cmd" &> /dev/null; then return 0; fi
    if [[ "$name" == "Qoder" ]] && [[ -f "$HOME/.local/bin/qodercli" ]]; then return 0; fi
    if [[ "$name" == "Hermes" ]] && [[ -f "$HOME/.hermes/bin/hermes" ]]; then return 0; fi
    if [[ "$name" == "Codegraph" ]] && [[ -f "$HOME/.cargo/bin/codegraph" ]]; then return 0; fi
    if [[ "$name" == "SkillOpt" ]]; then
        python3 -c "import skillopt" &>/dev/null && return 0
    fi
    return 1
}

invoke_install() {
    local p_id=$1
    local name="${P_NAME[$p_id]}"
    local install_cmd="${P_INSTALL[$p_id]}"
    
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📦 正在一键自动部署框架插件: ${BOLD}$name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ "$name" == "CodeBuddy" || "$name" == "OpenCode" || "$name" == "Claude_Code" ]]; then
        if ! command -v npm &> /dev/null; then echo -e "${RED}✗ npm 未安装${NC}"; return 1; fi
    fi
    if [[ "$name" == "Qwen_Code" || "$name" == "Qoder" ]]; then
        if ! ensure_node_20; then echo -e "${RED}✗ 无法激活 Node.js 20+ 环境${NC}"; return 1; fi
    fi
    
    eval "$install_cmd"
    fix_path
    echo -e "${GREEN}✓ $name 安装流程执行完毕${NC}"
}

invoke_start() {
    local idx=$1
    local p_id="${PLUGINS_KEYS[$idx]}"
    local name="${P_NAME[$p_id]}"
    local run_cmd="${P_RUN[$p_id]}"
    
    cd "$START_DIR" 2>/dev/null || true
    
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ 启动引擎: ${BOLD}$name${NC} (分类: [${P_TYPE[$p_id]}])"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ "$name" == "GitHub_Copilot" || "$name" == "CodeGeeX" ]]; then
        echo -e "${YELLOW}🔌 $name 是 IDE 插件，请在编辑器内部直接启用。${NC}"
        return
    fi
    
    if ! check_plugin_status "$p_id"; then
        echo -e "${YELLOW}⚠ $name 尚未安装系统响应网卡${NC}"
        read -p "是否立刻启动一键自动安装调度器? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            invoke_install "$p_id"
        else
            return
        fi
    fi
    
    export PATH="$HOME/.cargo/bin:$PATH"
    fix_path
    
    echo -e "${GREEN}▶ 正在当前目录执行: $run_cmd${NC}\n"
    
    if [[ "$name" == "TRAE_SOLO" ]]; then
        if [[ "$OS" == "macOS" && -d "/Applications/Trae.app" ]]; then
            open /Applications/Trae.app
        else
            eval "$run_cmd" &
        fi
    elif [[ "$name" == "Cursor" || "$name" == "Windsurf" ]]; then
        if [[ "$OS" == "macOS" ]]; then
            open -a "$run_cmd" 2>/dev/null || (eval "$run_cmd" &)
        else
            eval "$run_cmd" &
        fi
    else 
        eval "$run_cmd"
    fi
}

# ⚡【关键修复点】显式强行导出，阻止任何子进程丢失函数句柄
export -f register_plugins check_plugin_status invoke_install invoke_start