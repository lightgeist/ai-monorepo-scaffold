# AtlasCode
### by Deep Intuition · v0.1.0

终端编程助手。本版本只调整产品名称、主题、配置和发布标识，并修复这些调整引起的兼容性问题；不修改 Pi，不新增代理架构。

## 安装

解压发布包，然后安装包内的 npm 文件。本版本不声称已发布到公共 npm 注册表。

```bash
npm install -g ./distribution/deepintuition-atlascode-0.1.0.tgz
atlascode --version
atlascode
```

需要 Node.js 22.19+（22.x），或 24.2+ 至 26.x。原生依赖可能需要本机 C++ 编译工具。通过 `atlascode provider --help` 查看模型配置。使用真实提供商的地址、模型标识和 API 密钥；不要把账号或密钥提交到仓库。

新配置目录为 `~/.atlascode`。现有终端交互、工具、会话、权限、上下文管理和快捷键保持原有行为。升级时先备份配置；历史兼容标识、真实模型名称和必要的上游版权说明保留。

完整安装和验证说明见 [英文文档](README.md) 与发布包中的 evidence 目录。未验证的外部服务和平台不会标记为通过。
