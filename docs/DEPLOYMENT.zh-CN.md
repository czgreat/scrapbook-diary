# 部署说明

**语言：** [English](DEPLOYMENT.md) | 中文

本文说明如何在本地、Docker 或手工服务模式下运行 `scrapbook-diary`。默认你已经 clone 了 GitHub 仓库，并在仓库根目录操作。

## 已经可以使用

- 可用 `npm run dev` 本地运行
- 可用 `npm run build` 构建静态资源
- 可用示例 Docker/Nginx 配置托管
- 可作为个人本地图文草稿工具使用

## 你需要自己提供

- 现代 Node.js 运行时和 npm
- 一个用于保存本地草稿的浏览器配置
- 你自己的图片素材；不要提交私人媒体

## 本地开发

```bash
npm install
npm run dev
```

如果命令里出现 `. .venv/bin/activate`，Windows PowerShell 下请改用 `.venv\Scripts\Activate.ps1`。

## Docker 部署

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

运行 Docker 前，请先检查所有 volume 映射和 `.env`。示例 compose 文件只提供通用起点，需要按你的主机路径和端口修改。

## 手工部署

- 执行 `npm run build` 生成 `dist/`。
- 用任意静态 Web 服务器托管 `dist/`。
- 如果不是本机访问，生产环境建议启用 HTTPS。

## 配置检查清单

- 默认本地工作流不需要服务端配置。
- 浏览器数据绑定到站点 origin，修改域名或清理站点数据会导致草稿不可见。

## 验证命令

```bash
npm run lint --if-present
npm run build
```

## 生产检查清单

- 真实使用前替换所有占位密钥。
- 私有配置、生成数据、日志、上传文件和产物不要放进 Git。
- 如果服务会被其他设备访问，请放到启用 HTTPS 的反向代理后面。
- 私有 API 暴露到 localhost 以外前，请先增加鉴权。
- 为数据库、状态目录、上传文件和生成产物配置备份。
- 处理安全问题前先阅读 `SECURITY.md`。

## 排障建议

- 先复查 `.env` 和 volume 路径；多数部署问题来自路径或权限。
- 用 `README.md` 里列出的健康检查接口区分进程启动问题和业务问题。
- 修改部署基础设施前，先跑验证命令。
- 让 AI assistant 帮忙时，提供操作系统、运行时版本、完整命令、去敏日志和部署模式。
