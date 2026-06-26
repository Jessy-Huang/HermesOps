#!/usr/bin/env bash
# ==============================================================================
# HermesOps - 动态弹性 UI 渲染层 (v4.0.0)
# ==============================================================================

get_quota_render() {
    local quota=$1
    case "$quota" in
        "∞ 无限"|"∞ 本地"|"∞ 免费") echo -e "${GREEN}${quota}${NC}" ;;
        "≈140次/日"|"≈35次/日")      echo -e "${GREEN}${quota}${NC}" ;;
        "≈1200次/月"|"≈15积分")    echo -e "${YELLOW}${quota}${NC}" ;;
        "需配置"|"需订阅")          echo -e "${DIM}🔑 需配置${NC}" ;;
        *)                       echo -e "${DIM}${quota}${NC}" ;;
    esac
}

show_dashboard() {
    clear
    fix_path
    register_plugins # 每次刷主界面重新全量动态检索插件，支持热插拔
    
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}  ${BOLD}${WHITE}🚀 HermesOps v5.0 (Plugin Native)${NC}                        ${CYAN}⚡ 模块化插件系统${NC}  ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    local node_ver=$(node --version 2>/dev/null || echo "未安装")
    local py_ver=$(python3 --version 2>/dev/null | cut -d' ' -f2 || echo "未安装")
    echo -e "${DIM}┌─ 环境安全 ──────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${DIM}│${NC}  OS: ${WHITE}$OS${NC}  |  Node: ${WHITE}$node_ver${NC}  |  Python: ${WHITE}$py_ver${NC}  |  当前目录: ${WHITE}$START_DIR${NC}"
    echo -e "${DIM}└────────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    echo -e "${BOLD}${WHITE}  #  分类     工具名称           状态      额度剩余             优缺点${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local count=${#PLUGINS_KEYS[@]}
    for ((i=0; i<count; i++)); do
        local num=$((i+1))
        local p_id="${PLUGINS_KEYS[$i]}"
        
        local name="${P_NAME[$p_id]}"
        local type="${P_TYPE[$p_id]}"
        local pros="${P_PROS[$p_id]}"
        local cons="${P_CONS[$p_id]}"
        local quota_raw="${P_QUOTA[$p_id]}"
        
        local status="❌"
        local status_color="${RED}"
        
        if [[ "$name" == "GitHub_Copilot" || "$name" == "CodeGeeX" ]]; then
            status="🔌"
            status_color="${YELLOW}"
        elif check_plugin_status "$p_id"; then
            status="✅"
            status_color="${GREEN}"
        fi
        
        local quota_ui=$(get_quota_render "$quota_raw")
        
        # 格式化打印
        printf "${WHITE}%3d.${NC} " "$num"
        printf "${BLUE}[%-4s]${NC} " "$type"
        printf "${CYAN}%-16s${NC} " "$name"
        printf "${status_color}%-2s${NC}   " "$status"
        printf "%-18s" "$quota_ui"
        printf "${DIM}%s | %s${NC}\n" "$pros" "$cons"
    done
    
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}${WHITE}操作:${NC}"
    echo -e "  ${GREEN}[数字]${NC} 启动与自动部署  ${BLUE}[a]${NC} 全量列表  ${PURPLE}[r]${NC} 强制重载刷新  ${RED}[q]${NC} 退出安全域"
    echo ""
}

install_menu() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📦 已注册全量组件列表${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    local count=${#PLUGINS_KEYS[@]}
    for ((i=0; i<count; i++)); do
        local num=$((i+1))
        local p_id="${PLUGINS_KEYS[$i]}"
        local status="${RED}(未安装)${NC}"
        if check_plugin_status "$p_id"; then status="${GREEN}(已安装)${NC}"; fi
        printf "  %2d. [%-4s] %-16s %b\n" "$num" "${P_TYPE[$p_id]}" "${P_NAME[$p_id]}" "$status"
    done
    echo "   0. 返回主控制台"
    echo ""
    read -p "选择编号执行安装守护: " choice
    if [[ $choice -eq 0 || -z $choice ]]; then return; fi
    local idx=$((choice - 1))
    if [[ $idx -ge 0 && $idx -lt ${#PLUGINS_KEYS[@]} ]]; then
        invoke_install "${PLUGINS_KEYS[$idx]}"
    fi
}

export -f show_dashboard install_menu