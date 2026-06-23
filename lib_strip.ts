import { stripHtml as _stripHtml } from "string-strip-html";

/**
 * 清理 HTML 源码，移除所有 HTML 标签，返回纯文本
 * @param html - 包含 HTML 标签的字符串
 * @returns 清理后的纯文本
 */
export function stripHtml(html: string): string {
    return _stripHtml(html).result;
}