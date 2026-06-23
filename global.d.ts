// ============================================================
//  Renderer -> Main API (exposed via webview.expose("api", ...))
// ============================================================

interface FileInfo {
    path: string;
    name: string;
    dir?: string;
    size?: number;
    lines?: number;
}

interface ProcessResult {
    path: string;
    name: string;
    success: boolean;
    originalSize: number;
    newSize: number;
    originalLines: number;
    newLines: number;
    error?: string;
}

interface ApiResponse {
    results: ProcessResult[];
    errors: string[];
}

interface NativeApi {
    openFileDialog(): Promise<FileInfo[]>;
    processFiles(files: FileInfo[]): Promise<ApiResponse>;
}

declare global {
    interface Window {
        api: NativeApi;
        updateProgress(current: number, total: number): void;
        updateFileStatus(result: ProcessResult): void;
    }
}

export {};
