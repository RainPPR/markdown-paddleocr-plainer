import { Application } from "@webviewjs/webview";
import { stripHtml } from "./lib/strip.ts";
import { readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { basename, dirname } from "node:path";

import htmlContent from "./ui/lib.html" with { type: "text" };
// @ts-expect-error
import cssContent from "./ui/style.css" with { type: "text" };
import jsContent from "./ui/script.js" with { type: "text" };

// ============================================================
//  Types (shared with renderer via expose / used in handler)
// ============================================================

export interface FileInfo {
    path: string;
    name: string;
    dir?: string;
    size?: number;
    lines?: number;
}

export interface ProcessResult {
    path: string;
    name: string;
    success: boolean;
    originalSize: number;
    newSize: number;
    originalLines: number;
    newLines: number;
    error?: string;
}

// ============================================================
//  Application lifecycle
// ============================================================

const app = new Application();
const browserWindow = app.createBrowserWindow({
    title: "Markdown HTML Stripper",
    width: 1400,
    height: 900,
    resizable: true,
});

const webview = browserWindow.createWebview({
    enableDevtools: true,
});

// ============================================================
//  Backend actions  (exposed to renderer via webview.expose)
// ============================================================

async function pickFiles(): Promise<FileInfo[]> {
    const paths = await browserWindow.openFileDialog({
        multiple: true,
        title: "选择 Markdown 文件",
        filters: [{ name: "Markdown files", extensions: ["md", "markdown"] }],
    });

    if (!paths || paths.length === 0) {
        return [];
    }

    return Promise.all(
        paths.map(async (path: string): Promise<FileInfo> => {
            try {
                const stats = await stat(path);
                const content = await readFile(path, "utf-8");
                return {
                    path,
                    name: basename(path),
                    dir: dirname(path),
                    size: stats.size,
                    lines: countLines(content),
                };
            } catch {
                return {
                    path,
                    name: basename(path),
                    dir: dirname(path),
                    size: 0,
                    lines: 0,
                };
            }
        })
    );
}

async function processFiles(files: FileInfo[]): Promise<{ results: ProcessResult[]; errors: string[] }> {
    const errors: string[] = [];
    const results: ProcessResult[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        // 通知进度
        webview.evaluateScript(`window.updateProgress && window.updateProgress(${i}, ${total})`);
        await yieldToUI();

        try {
            // 备份原文件
            const backupPath = `${file.path}.bak`;
            await copyFile(file.path, backupPath);

            // 读取文件内容
            const content = await readFile(file.path, "utf-8");
            const originalSize = new TextEncoder().encode(content).length;
            const originalLines = countLines(content);

            // 处理内容
            const processedContent = await processLargeFile(content);
            const newSize = new TextEncoder().encode(processedContent).length;
            const newLines = countLines(processedContent);

            // 覆盖写入原文件
            await writeFile(file.path, processedContent, "utf-8");

            const result: ProcessResult = {
                path: file.path,
                name: file.name,
                success: true,
                originalSize,
                newSize,
                originalLines,
                newLines,
            };
            results.push(result);

            // 实时通知前端文件处理完成
            webview.evaluateScript(
                `window.updateFileStatus && window.updateFileStatus(${JSON.stringify(result)})`
            );

            console.log(`处理完成: ${file.name}`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const fullError = `【${file.name}】 ${errorMsg}`;
            console.error(fullError);
            errors.push(fullError);

            results.push({
                path: file.path,
                name: file.name,
                success: false,
                originalSize: file.size || 0,
                newSize: 0,
                originalLines: file.lines || 0,
                newLines: 0,
                error: errorMsg,
            });
        }
    }

    // 完成时更新进度到 100%
    webview.evaluateScript(`window.updateProgress && window.updateProgress(${total}, ${total})`);

    return { results, errors };
}

// ============================================================
//  Expose API to renderer (replaces manual IPC)
// ============================================================

// ============================================================
//  IPC 消息处理 (替代 webview.expose，前端通过 window.ipc.postMessage 通信)
// ============================================================

webview.onIpcMessage(async (message) => {
    let body: string;
    try {
        body = message.body.toString("utf-8");
    } catch {
        return;
    }

    let req: { id: string; action: string; payload?: unknown };
    try {
        req = JSON.parse(body);
    } catch {
        return;
    }

    const sendResponse = (data: unknown, success = true, error?: string) => {
        const resp = JSON.stringify({ id: req.id, success, data, error });
        webview.evaluateScript(`window.__ipcHandleResponse && window.__ipcHandleResponse(${resp})`);
    };

    if (req.action === "openFileDialog") {
        try {
            const files = await pickFiles();
            sendResponse(files);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            sendResponse(null, false, msg);
        }
    } else if (req.action === "processFiles") {
        try {
            const files = req.payload as FileInfo[];
            const result = await processFiles(files);
            sendResponse(result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            sendResponse(null, false, msg);
        }
    }
});

// ============================================================
//  Helpers
// ============================================================

function countLines(content: string): number {
    return content.split(/\r?\n/).length;
}

function yieldToUI(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function processLargeFile(content: string): Promise<string> {
    // 分 chunk 可能导致 HTML 标签断裂，暂时注释掉
    /*
    const CHUNK_SIZE = 50000;

    if (content.length <= CHUNK_SIZE) {
        return stripHtml(content);
    }

    const results: string[] = [];
    let position = 0;

    while (position < content.length) {
        const end = Math.min(position + CHUNK_SIZE, content.length);
        const chunk = content.slice(position, end);
        results.push(stripHtml(chunk));
        await yieldToUI();
        position = end;
    }

    return results.join("");
    */
    return stripHtml(content);
}

async function buildHtml(): Promise<string> {
    // const [htmlContent, cssContent, jsContent] = await Promise.all([
    //     ui_html, ui_css, ui_js
    //     // Bun.file("ui/lib.html").text(),
    //     // Bun.file("ui/style.css").text(),
    //     // Bun.file("ui/script.js").text(),
    // ]);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Markdown HTML Stripper</title>
<style>
${cssContent}
</style>
</head>
<body>
<div class="container">
${htmlContent}
</div>
<script>
${jsContent}
</script>
</body>
</html>`;
}

// ============================================================
//  Start
// ============================================================

const html = await buildHtml();
webview.loadHtml(html);
app.run();
