# Scrapbook Diary / 图文日记编辑器

[![CI](https://github.com/czgreat/scrapbook-diary/actions/workflows/ci.yml/badge.svg)](https://github.com/czgreat/scrapbook-diary/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**语言：** [English](README.md) | 中文

本地优先的图文日记编辑器，用于在不运行后端的情况下编排图片丰富的日常内容。

## 概览

Scrapbook Diary 是一个 Vite + React 应用，适合编写图文日记、社交平台草稿或轻量内容板。图片、正文、话题、封面选择和草稿元数据保存在浏览器 IndexedDB 中。

## 主要功能

- 按日期组织的日记/草稿工作流
- 多图上传、排序、封面选择和预览
- 常见发布比例的封面预设
- 编辑器内调整裁切、位置和缩放
- 浏览器本地持久化，不依赖远程数据库

## 当前公开版状态

已经可以使用：

- 可用 `npm run dev` 本地运行
- 可用 `npm run build` 构建静态资源
- 可用示例 Docker/Nginx 配置托管
- 可作为个人本地图文草稿工具使用

需要你在本地补全：

- 现代 Node.js 运行时和 npm
- 一个用于保存本地草稿的浏览器配置
- 你自己的图片素材；不要提交私人媒体

## 快速开始

```bash
npm install
npm run dev
```

如果在 Windows PowerShell 使用 Python 虚拟环境，请用 `.venv\Scripts\Activate.ps1`，不要用 `. .venv/bin/activate`。

## Docker 部署

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

## 手工部署

- 执行 `npm run build` 生成 `dist/`。
- 用任意静态 Web 服务器托管 `dist/`。
- 如果不是本机访问，生产环境建议启用 HTTPS。

## 配置说明

- 默认本地工作流不需要服务端配置。
- 浏览器数据绑定到站点 origin，修改域名或清理站点数据会导致草稿不可见。

## 验证命令

```bash
npm run lint --if-present
npm run build
```

## 仓库结构

| 路径 | 说明 |
|---|---|
| `src/App.tsx` | 主要 React 编辑器 |
| `src/storage.ts` | IndexedDB 持久化辅助逻辑 |
| `public/` | 静态资源 |
| `server.mjs` | 轻量本地静态服务 |
| `docker-compose.example.yml` | 容器部署示例 |

## 更多文档

| 主题 | 中文 | English |
|---|---|---|
| 部署 | [docs/DEPLOYMENT.zh-CN.md](docs/DEPLOYMENT.zh-CN.md) | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| AI 接手 | [docs/AI_HANDOFF.zh-CN.md](docs/AI_HANDOFF.zh-CN.md) | [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) |
| 路线图 | [docs/ROADMAP.zh-CN.md](docs/ROADMAP.zh-CN.md) | [docs/ROADMAP.md](docs/ROADMAP.md) |

## AI 辅助开发说明

这个公开版由 Codex 使用 GPT-5.4 和 GPT-5.5 辅助整理完成。源码、文档和公开前清理都经过面向公开分享的复核，但本项目是社区项目，不是 OpenAI 官方产品。

适合继续交给 AI coding assistant 的任务：

- 增加本地草稿导入/导出
- 增加浏览器存储迁移测试
- 优化移动端编辑体验
- 增加上传和预览流程的 Playwright 冒烟测试

## 隐私和密钥

不要提交真实 `.env`、API key、webhook secret、cookies、私人媒体、生产数据库、日志、生成产物或个人数据。请从示例配置开始，把私有值保存在 Git 之外。

## License

MIT
