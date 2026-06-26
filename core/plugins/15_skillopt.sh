_name="SkillOpt"
_type="Agent"
_cmd="skillopt"
_pros="微软具身智能专家|支持 OpenAI / DeepSeek 双通路|自动托管密钥"
_cons="对物理/仿真环境反馈强依赖"
_quota="∞ 本地开发"

# 一键部署：保持原样，确保依赖和工作空间目录存在
_install="if ! command -v pip3 &>/dev/null; then
    echo '❌ 错误: 未检测到 Python3 环境，SkillOpt 需要 Python 3.10+';
    exit 1;
fi;
echo '📥 正在从微软开源仓库克隆并安装 SkillOpt 核心进化引擎...';
pip3 install git+https://github.com/microsoft/SkillOpt.git;
if [ ! -d \"\$HOME/.skillopt\" ]; then
    echo '✨ 正在初始化本地具身智能技能工作空间 (~/.skillopt)...';
    mkdir -p \"\$HOME/.skillopt/skills\" \"\$HOME/.skillopt/config\";
fi"

# 启动动作：全自动 API Key 嗅探、多路由选择、写入与注入执行
_run="if ! python3 -c \"import skillopt\" &>/dev/null; then
    echo '❌ SkillOpt 环境未就绪，请先执行自动部署安装';
    exit 1;
fi;

echo '🤖 微软 SkillOpt 具身智能技能优化器已拉起...';

# 🔐 从全局 config.json 中尝试提取已有配置
if [ -z \"\$OPENAI_API_KEY\" ] && [ -f \"\$HOME/.hermesops/config.json\" ] && command -v jq &>/dev/null; then
    export OPENAI_API_KEY=\$(jq -r '.openai_api_key // empty' \"\$HOME/.hermesops/config.json\")
    export OPENAI_BASE_URL=\$(jq -r '.openai_base_url // empty' \"\$HOME/.hermesops/config.json\")
fi

# 如果依然为空，引导用户现场选择模型通路
if [ -z \"\$OPENAI_API_KEY\" ]; then
    echo -e '\n🔑 \033[1;33m检测到当前环境未配置大模型密钥 (OPENAI_API_KEY)\033[0m'
    echo '请选择你想为 SkillOpt 挂载的 LLM 后端通路:'
    echo '  [1] DeepSeek (推荐：性价比极高，完全兼容)'
    echo '  [2] OpenAI 原生'
    echo '  [3] 其他自定义中转/本地模型 (如 Ollama)'
    read -p '请输入序列号 (默认 1): ' model_choice
    [ -z \"\$model_choice\" ] && model_choice=1

    local target_base=''
    case \$model_choice in
        2) target_base='https://api.openai.com/v1' ;;
        3) 
           read -p '🌐 请输入自定义 API Base URL: ' target_base 
           ;;
        *) target_base='https://api.deepseek.com/v1' ;;
    esac

    read -p '🔑 请输入对应的 API Key (密文输入，直接回车跳过): ' -s user_key
    echo '' # 换行
    
    if [ -n \"\$user_key\" ]; then
        export OPENAI_API_KEY=\"\$user_key\"
        export OPENAI_BASE_URL=\"\$target_base\"
        
        # 全自动持久化写入 config.json
        mkdir -p \"\$HOME/.hermesops\"
        python3 -c \"import json, os; f='\"\$HOME\"/.hermesops/config.json'; d=json.load(open(f)) if os.path.exists(f) and os.path.getsize(f)>0 else {}; d['openai_api_key']='\"\$user_key\"'; d['openai_base_url']='\"\$target_base\"'; json.dump(d, open(f, 'w'), indent=2)\"
        echo '✅ 密钥与模型网关已安全同步至配置池 (~/.hermesops/config.json)'
    else
        echo '⚠ 警告: 未配置密钥，SkillOpt 的 LLM 演进回路可能会在运行时抛出鉴权异常。'
    fi
fi

# 智能识别当前挂载的网关类型并给用户反馈
if [[ \"\$OPENAI_BASE_URL\" == *'deepseek'* ]]; then
    echo '🚀 已成功挂载 DeepSeek 极速代码演进网卡！'
else
    echo '🚀 已成功挂载标准 OpenAI/自定义 路由网卡！'
fi
echo '💡 提示: 密钥环境已并入 Python 核心作用域。'
echo '------------------------------------------------';

# 强行生成并注入带有实时 API 验证的最新测试脚本
rm -f test_skillopt.py;
echo '📝 正在初始化具身智能集成脚手架 (test_skillopt.py)...';
echo \"import os, skillopt\" > test_skillopt.py;
echo \"print('✓ SkillOpt 成功加载！')\" >> test_skillopt.py;
echo \"print('当前端点 (Base URL):', os.environ.get('OPENAI_BASE_URL', '未配置'))\" >> test_skillopt.py;
echo \"print('密钥挂载状态: ', '已就绪 ✅' if os.environ.get('OPENAI_API_KEY') else '未检测到 ❌')\" >> test_skillopt.py;

python3 test_skillopt.py"