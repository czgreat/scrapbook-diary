# Scrapbook Diary / 图文日记编辑器

[English](README.md) | [中文](README.zh-CN.md)

Scrapbook Diary 是一个本地优先的图文日记编辑器，交互上参考了图片内容创作工具。它不依赖后端，图片、正文、话题、版式和发布信息都保存在浏览器本地。


## AI 辅助开发说明

这个公开版由 Codex 在 GPT-5.4 / GPT-5.5 辅助下整理完成。代码、文档和公开前清理已按公开仓库标准处理，但本项目不是 OpenAI 官方产品。


## 主要能力

- 按日历选择日期并编辑当天草稿
- 多图上传、排序和封面选择
- 封面比例：`3:4`、`1:1`、`4:5`、`9:16`
- 在预览区直接裁切、拖动和缩放图片
- 支持标题、正文、话题、地点、可见范围、发布时间等草稿字段
- 使用 IndexedDB 做浏览器本地持久化
- React + Vite，支持静态部署

## 结构

```text
src/
  App.tsx        主编辑体验
  storage.ts     IndexedDB 持久化
  App.css        页面样式与布局
public/          静态资源
server.mjs       本地静态服务
```

## 快速开始

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

## Docker

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

## 隐私说明

草稿保存在浏览器本地。清除站点数据会删除本地草稿。不要把个人图片或生成的 `dist/` 目录提交到仓库。

## License

MIT

