# Markdown HTML Stripper

一个桌面 GUI 工具，用于清理 PaddleOCR 等工具生成的 Markdown 文件中的繁杂 HTML 标签和格式，输出纯净的 Markdown 纯文本，方便用于 RAG（检索增强生成）等下游任务。

## 功能特性

- **批量文件处理**：支持同时选择并处理多个 Markdown 文件
- **自动备份**：处理前自动为原文件创建 `.bak` 备份
- **HTML 标签清理**：自动移除所有 HTML 标签，保留纯文本内容
- **可视化进度**：实时显示处理进度、文件大小和行数变化
- **结果统计**：直观展示每个文件的压缩比例和减少行数
- **安全操作**：处理失败时保留原文件，错误信息集中展示

## 技术栈

| 技术                                                          | 说明                    |
| ------------------------------------------------------------- | ----------------------- |
| [Bun](https://bun.sh/)                                        | 运行时与构建工具        |
| TypeScript                                                    | 严格模式类型安全        |
| [@webviewjs/webview](https://github.com/webviewjs/webview)    | 跨平台桌面 WebView 窗口 |
| [string-strip-html](https://codsen.com/os/string-strip-html/) | HTML 标签剥离引擎       |

## 项目结构

```text
markdown-paddleocr-plainer/
├── index.ts              # 主进程入口：创建窗口、IPC 通信、文件处理
├── global.d.ts           # 全局类型声明（主进程与渲染进程共享）
├── tsconfig.json         # TypeScript 严格模式配置
├── lib/
│   └── strip.ts          # HTML 清理核心逻辑
├── ui/
│   ├── lib.html          # 前端页面模板
│   ├── style.css         # 界面样式
│   └── script.js         # 前端交互与 IPC 通信
├── release/              # 编译输出目录（.gitignore 忽略）
└── package.json          # 项目配置与脚本
```

## 安装与运行

### 前置要求

- [Bun](https://bun.sh/) 已安装

### 安装依赖

```bash
bun install
```

### 开发运行

```bash
bun run dev
```

### 类型检查

```bash
bun run lint
```

## 打包发布

### 通用可执行文件

```bash
bun run bundle
```

输出至 `release/markdown-paddleocr-plainer`。

### Windows 可执行文件（隐藏控制台）

```bash
bun run bundle:windows
```

输出至 `release/markdown-paddleocr-plainer.exe`。

## 使用说明

1. 启动程序后，点击 **添加文件** 选择需要清理的 `.md` 或 `.markdown` 文件
2. 在 **待处理文件** 列表中查看已添加的文件信息（大小、行数）
3. 可勾选文件后点击 **删除选中** 移除不需要处理的文件，或 **清空列表** 重置
4. 点击 **开始处理**，程序将自动：
    - 为每个原文件生成 `.bak` 备份
    - 移除 HTML 标签并覆盖保存
    - 实时显示处理进度
5. 处理完成后在 **已完成** 列表中查看：
    - 原始大小 vs 处理后大小
    - 减少比例
    - 减少行数
6. 若出现错误，错误详情将显示在页面底部的错误区域

## 接口与类型

### FileInfo

```typescript
interface FileInfo {
    path: string; // 文件绝对路径
    name: string; // 文件名
    dir?: string; // 所在目录
    size?: number; // 文件大小（字节）
    lines?: number; // 行数
}
```

### ProcessResult

```typescript
interface ProcessResult {
    path: string; // 文件路径
    name: string; // 文件名
    success: boolean; // 是否成功
    originalSize: number; // 原始字节数
    newSize: number; // 处理后字节数
    originalLines: number; // 原始行数
    newLines: number; // 处理后行数
    error?: string; // 错误信息（失败时）
}
```

## 许可证

[Apache License 2.0](LICENSE)
