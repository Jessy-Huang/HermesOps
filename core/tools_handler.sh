#!/usr/bin/env bash
# ==============================================================================
# HermesOps - 工具执行业务层 (修正版)
# ==============================================================================

export TOOL_NAMES=(
    "CodeBuddy" "Qoder" "TRAE_SOLO" "Cursor" "OpenCode"
    "GitHub_Copilot" "Claude_Code" "Codex" "Qwen_Code"
    "Windsurf" "CodeGeeX" "MiMo_Code" "Hermes"
)

export TOOL_CMDS=(
    "codebuddy" "qodercli" "Trae" "cursor" "opencode"
    "copilot" "claude" "codex" "qwen"
    "windsurf" "codegeex" "mimo" "hermes"
)

export TOOL_INSTALL=(
    "npm install -g @tencent-ai/codebuddy-code"
    "curl -fsSL https://qoder.com/install | bash"
    "官网: https://www.trae.cn/ide 下载安装包"
    "官网: https://cursor.com 下载安装包"
    "npm install -g opencode-ai"
    "IDE插件市场安装 GitHub Copilot"
    "npm install -g @anthropic/claude-code"
    "curl -fsSL https://chatgpt.com/codex/install.sh | sh"
    "bash -c \"\$(curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh)\" -s --source bailian"
    "官网: https://windsurf.com 下载安装包"
    "IDE插件市场安装 CodeGeeX"
    "curl -fsSL https://mimo.xiaomi.com/install | bash"
    "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
)

export TOOL_RUN=(
    "codebuddy" "qodercli" "Trae" "cursor" "opencode"
    "copilot" "claude" "codex" "qwen"
    "windsurf" "codegeex" "mimo" "hermes"
)

get_tool_info() {
    local name=$1
    case $name in
        "CodeBuddy")       echo "完全免费|腾讯云npm|企业版收费|∞ 无限" ;;
        "Qoder")           echo "每日200次免费|Qwen3.7-Max|需登录|≈140次/日" ;;
        "TRAE_SOLO")       echo "完全免费|AI原生IDE|需下载桌面版|∞ 无限" ;;
        "Cursor")          echo "业界标杆|体验最佳|付费贵|需配置" ;;
        "OpenCode")        echo "开源免费|75+模型|需自备API|需配置" ;;
        "GitHub_Copilot")  echo "GitHub生态|学生免费|限免额度少|≈1200次/月" ;;
        "Claude_Code")     echo "Claude最强|模型优秀|需订阅|需订阅" ;;
        "Codex")           echo "OpenAI出品|跨设备|需订阅|需订阅" ;;
        "Qwen_Code")       echo "阿里云|Token Plan|需配置密钥|需配置" ;;
        "Windsurf")        echo "免费额度|界面好|使用频次限|≈15积分" ;;
        "CodeGeeX")        echo "清华出品|轻量|额度少|≈35次/日" ;;
        "MiMo_Code")       echo "完全免费|无限上下文|较新|∞ 无限" ;;
        "Hermes")          echo "自进化Agent|300+模型|需配置密钥|需配置" ;;
        *)                 echo "未知|未知|未知|未知" ;;
    esac
}

check_installed() {
    local idx=$1
    local cmd=${TOOL_CMDS[$idx]}
    local name=${TOOL_NAMES[$idx]}
    
    if [[ "$name" == "GitHub_Copilot" ]] || [[ "$name" == "CodeGeeX" ]]; then return 1; fi
    if [[ "$name" == "TRAE_SOLO" ]]; then
        if [[ "$OS" == "macOS" ]] && [[ -d "/Applications/Trae.app" ]]; then return 0; fi
        if command -v "trae" &> /dev/null; then return 0; fi
        return 1
    fi
    if command -v "$cmd" &> /dev/null || which "$cmd" &> /dev/null; then return 0; fi
    if [[ "$name" == "Qoder" ]] && [[ -f "$HOME/.local/bin/qodercli" ]]; then return 0; fi
    if [[ "$name" == "Hermes" ]] && [[ -f "$HOME/.hermes/bin/hermes" ]]; then return 0; fi
    return 1
}

install_tool() {
    local idx=$1
    local name=${TOOL_NAMES[$idx]}
    local install_cmd=${TOOL_INSTALL[$idx]}
    
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📦 安装 ${BOLD}$name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    case $name in
        "CodeBuddy"|"OpenCode"|"Claude_Code")
            if ! command -v npm &> /dev/null; then echo -e "${RED}✗ npm 未安装${NC}"; return 1; fi
            eval "$install_cmd"
            ;;
        "Qwen_Code"|"Qoder")
            if ! ensure_node_20; then echo -e "${RED}✗ 无法切换到 Node.js 20+${NC}"; return 1; fi
            eval "$install_cmd"
            ;;
        "Codex"|"MiMo_Code"|"Hermes")
            eval "$install_cmd"
            ;;
        *)
            echo -e "${YELLOW}📌 $install_cmd${NC}"
            echo -e "${YELLOW}📌 请手动完成安装${NC}"
            if [[ "$OS" == "macOS" ]]; then
                case $name in
                    "TRAE_SOLO") open "https://www.trae.cn/ide" ;;
                    "Cursor") open "https://cursor.com" ;;
                    "Windsurf") open "https://windsurf.com" ;;
                esac
            fi
            ;;
    esac
    fix_path
    echo -e "${GREEN}✓ 安装动作处理完成${NC}"
}

start_tool() {
    local idx=$1
    local name=${TOOL_NAMES[$idx]}
    local run_cmd=${TOOL_RUN[$idx]}
    
    cd "$START_DIR" 2>/dev/null || true
    
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ 启动 ${BOLD}$name${NC} (在 $(pwd))"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ "$name" == "GitHub_Copilot" ]] || [[ "$name" == "CodeGeeX" ]]; then
        echo -e "${YELLOW}🔌 $name 是IDE插件，请在IDE中启用${NC}"
        return
    fi
    
    if [[ "$name" == "Qwen_Code" ]] || [[ "$name" == "Qoder" ]]; then
        if ! ensure_node_20; then echo -e "${RED}✗ 无法切换到 Node.js 20+${NC}"; return 1; fi
        fix_path
    fi
    
    if ! check_installed "$idx"; then
        echo -e "${YELLOW}⚠ $name 尚未安装${NC}"
        read -p "是否立即安装? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_tool "$idx"
        else
            return
        fi
    fi
    
    echo -e "${GREEN}▶ 执行: $run_cmd${NC}\n"
    
    case $name in
        "TRAE_SOLO")
            if [[ "$OS" == "macOS" ]] && [[ -d "/Applications/Trae.app" ]]; then 
                open /Applications/Trae.app
            else 
                eval "$run_cmd" & 
            fi
            ;;
        "Cursor"|"Windsurf")
            if [[ "$OS" == "macOS" ]]; then 
                open -a "$run_cmd" 2>/dev/null || (eval "$run_cmd" &)
            else 
                eval "$run_cmd" & 
            fi
            ;;
        *)
            eval "$run_cmd"
            ;;
    esac
}

export -f get_tool_info check_installed install_tool start_tool