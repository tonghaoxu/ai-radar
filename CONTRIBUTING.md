# 贡献指南

感谢你对 AI Radar 的关注！本项目是个人学习研究项目，欢迎提交 Issue 和 Pull Request。

## 如何贡献

### 报告 Bug

1. 在 [Issues](https://github.com/tonghaoxu/ai-radar/issues) 中搜索，确认问题未被报告
2. 使用清晰的标题描述问题
3. 提供复现步骤、预期行为和实际行为
4. 附上环境信息（操作系统、Node.js 版本）

### 提交功能建议

1. 在 Issues 中创建 Feature Request
2. 描述你希望的功能和解决什么问题
3. 如果有实现思路，欢迎说明

### 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 确保代码通过 ESLint：`npm run lint`
4. 确保构建通过：`npm run build`
5. 提交时使用清晰的信息（参考已有提交风格）
6. 推送到你的 fork 并创建 Pull Request

## 开发环境

```bash
npm install       # 安装依赖
npm run seed      # 初始化种子数据
npm run dev       # 启动开发服务器 (localhost:3000)
```

## 代码风格

- 使用 TypeScript 严格模式
- 组件使用函数式 + Hooks
- API 路由保持 RESTful 风格
- 提交信息使用中文或英文均可，保持简洁明了

## 许可

贡献的代码将采用与本项目相同的 [AGPL-3.0](LICENSE) 许可证。
