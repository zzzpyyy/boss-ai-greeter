# Boss AI Greeter

一个用于 Boss 直聘场景的 Chrome 插件 MVP：
- 上传或粘贴简历内容
- 解析当前职位 JD
- 基于简历与 JD 生成更有针对性的中文招呼语
- 将招呼语填入页面输入框，供用户手动确认发送

## Features

- AI 配置本地保存
  - 支持自定义 `Base URL`
  - 支持手动填写 `API Key`
  - 支持显示 / 隐藏 / 清空 API Key
  - 支持保存状态与脱敏展示
- 简历处理
  - 支持粘贴文本
  - 支持上传 `PDF`
  - 支持上传 `DOCX`
  - 可提取结构化简历亮点
- JD 处理
  - 从当前 Boss 直聘页面抓取职位信息
  - 自动做结构化 JD 提取
  - 对 content script 注入失败有兜底处理
- 招呼语生成
  - 根据简历亮点 + JD 关键词生成中文开场白
  - 已优化为更强调匹配度、项目亮点和岗位针对性
- 本地持久化
  - 保存 AI 配置
  - 保存简历原文
  - 保存已提取的简历结构
  - 保存已提取的 JD 结构

## Current Scope

当前版本是 MVP，重点解决“辅助生成和填入”，不做自动发送。

- 支持：生成招呼语、填入输入框、用户手动确认发送
- 不支持：自动点击发送、自动批量投递、绕过平台限制的自动化行为

## Tech Stack

- Chrome Extension Manifest V3
- React 18
- TypeScript
- Vite
- `pdfjs-dist`：PDF 文本提取
- `mammoth`：DOCX 文本提取

## Project Structure

```text
.
├── manifest.json
├── popup.html
├── package.json
├── src
│   ├── background
│   │   └── index.ts
│   ├── content
│   │   └── index.ts
│   ├── popup
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── shared
│   │   ├── ai.ts
│   │   ├── docx.ts
│   │   ├── pdf.ts
│   │   ├── prompts.ts
│   │   ├── storage.ts
│   │   └── types.ts
│   └── vite-env.d.ts
├── tsconfig.json
└── vite.config.ts
```

## How It Works

1. 在插件弹窗中填写 AI 配置
2. 上传 PDF / DOCX 简历，或直接粘贴简历文本
3. 点击“提取简历亮点”生成结构化简历信息
4. 打开 Boss 直聘职位页，点击“抓取并解析 JD”
5. 点击“生成招呼语”
6. 点击“填入输入框”，再由用户手动确认发送

## Installation

### 1. Clone

```bash
git clone git@github.com:zzzpyyy/boss-ai-greeter.git
cd boss-ai-greeter/extension
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Load into Chrome

1. 打开 Chrome 扩展管理页：`chrome://extensions/`
2. 打开“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前项目中的 `dist` 目录

## Usage

### AI configuration

在插件中配置以下内容：
- `Base URL`：兼容 OpenAI Chat Completions 的接口地址
- `API Key`
- `Model`

默认值：
- Base URL: `https://api.openai.com/v1`
- Model: `gpt-4o-mini`

## Permissions

插件当前使用以下权限：
- `storage`：保存本地配置与提取结果
- `activeTab`：访问当前标签页
- `scripting`：必要时动态注入 content script
- `tabs`：查询当前活动标签

Host 权限：
- `https://www.zhipin.com/*`
- `https://api.openai.com/*`

如果你使用其他兼容 OpenAI 的服务，需要同步调整 `host_permissions`。

## Important Notes

- 当前只适配 Boss 直聘页面的常见 DOM 结构，页面结构变化后可能需要更新选择器
- PDF 提取依赖文本层，扫描版 PDF 可能无法正确解析
- 本项目默认直接从前端调用 AI 接口，请妥善保管 API Key
- 当前版本不做自动发送，避免高风险自动化行为

## Development

开发监听构建：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

## Known Limitations

- 目前 JD 抓取依赖页面结构，鲁棒性有限
- Popup bundle 较大，构建时会出现 chunk size warning
- 目前未持久化“已生成的招呼语”文本本身
- 暂未支持多风格招呼语切换

## Roadmap

- 支持多种招呼语风格切换
- 持久化已生成招呼语
- 增强 JD 抓取选择器策略
- 优化构建体积
- 完善更多错误提示与状态展示

## Version

当前准备发布版本：`v0.1.0`

## License

MIT
