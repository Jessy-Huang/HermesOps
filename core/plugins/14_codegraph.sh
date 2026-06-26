_name="CodeGraph"
_type="Code"
_cmd="codegraph"
_pros="100%本地|MCP多模型联动|零文件同步"
_cons="Rust/SQLite内核本地高负载解析"
_quota="∞ 本地图谱"

# 升级版一键安装与全局 AI 工具 MCP 联动挂载
_install="if ! command -v codegraph &>/dev/null; then 
    echo '📥 正在下载 CodeGraph 本地专用二进制包...';
    curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh;
fi;
export PATH=\"\$HOME/.cargo/bin:\$PATH\";
echo '🔗 正在启动 CodeGraph 全局 MCP 路由注册...';
codegraph install --yes"

# 启动动作：如果当前目录未初始化，自动 init 并建立图谱监控
_run="export PATH=\"\$HOME/.cargo/bin:\$PATH\";
if [ ! -d \".codegraph\" ]; then
    echo '✨ 检测到当前项目尚未建立语义知识图谱，正在执行全量初始化...';
    codegraph init;
else
    echo '⚡ 当前目录 CodeGraph 语义网络已就位，正在触发增量同步与状态同步...';
    codegraph sync;
fi;
echo '📊 当前本地代码图谱状态统计：';
codegraph status"