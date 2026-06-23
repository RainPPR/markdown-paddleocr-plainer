(function () {
    "use strict";

    // ============================================================
    //  State
    // ============================================================

    const state = {
        pending: [],
        completed: [],
        selected: new Set(),
        processing: false,
    };

    // ============================================================
    //  DOM helpers
    // ============================================================

    const $ = (id) => document.getElementById(id);

    // ============================================================
    //  Utils
    // ============================================================

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    // ============================================================
    //  Render
    // ============================================================

    function renderPendingList() {
        const tbody = $("pending-list");
        const countEl = $("pending-count");
        const selectAll = $("select-all-pending");

        countEl.textContent = state.pending.length;
        tbody.innerHTML = "";
        selectAll.checked = false;
        selectAll.disabled = state.pending.length === 0;

        if (state.pending.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 6;
            td.className = "empty-state";
            td.textContent = '暂无文件，点击"添加文件"选择 Markdown 文件';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        for (let index = 0; index < state.pending.length; index++) {
            const file = state.pending[index];
            const isSelected = state.selected.has(index);
            const isError = file.status === "error";

            const tr = document.createElement("tr");
            tr.className = isError ? "error" : isSelected ? "selected" : "";
            tr.dataset.index = String(index);
            tr.addEventListener("click", () => toggleSelect(index));

            // checkbox
            const tdCb = document.createElement("td");
            tdCb.className = "col-checkbox";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.className = "file-checkbox";
            cb.checked = isSelected;
            cb.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleSelect(index);
            });
            tdCb.appendChild(cb);
            tr.appendChild(tdCb);

            // name
            const tdName = document.createElement("td");
            tdName.className = "col-name";
            tdName.title = file.name;
            tdName.textContent = file.name;
            tr.appendChild(tdName);

            // path
            const tdPath = document.createElement("td");
            tdPath.className = "col-path";
            tdPath.title = file.path;
            tdPath.textContent = file.path;
            tr.appendChild(tdPath);

            // size
            const tdSize = document.createElement("td");
            tdSize.className = "col-size";
            tdSize.textContent = formatBytes(file.size || 0);
            tr.appendChild(tdSize);

            // lines
            const tdLines = document.createElement("td");
            tdLines.className = "col-lines";
            tdLines.textContent = file.lines || "-";
            tr.appendChild(tdLines);

            // status
            const tdStatus = document.createElement("td");
            tdStatus.className = "col-status";
            const badge = document.createElement("span");
            badge.className = isError ? "status-badge error" : "status-badge pending";
            badge.textContent = isError ? "失败" : "待处理";
            tdStatus.appendChild(badge);
            tr.appendChild(tdStatus);

            tbody.appendChild(tr);
        }
    }

    function renderCompletedList() {
        const tbody = $("completed-list");
        const countEl = $("completed-count");

        countEl.textContent = state.completed.length;
        tbody.innerHTML = "";

        if (state.completed.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 8;
            td.className = "empty-state";
            td.textContent = "暂无已完成文件";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        for (let index = 0; index < state.completed.length; index++) {
            const file = state.completed[index];

            const reductionPercent =
                file.originalSize > 0
                    ? (((file.originalSize - file.newSize) / file.originalSize) * 100).toFixed(1)
                    : "0.0";
            const reductionClass = parseFloat(reductionPercent) >= 0 ? "reduction" : "reduction negative";
            const reductionText =
                (parseFloat(reductionPercent) >= 0 ? "-" : "+") + Math.abs(parseFloat(reductionPercent)) + "%";

            const tr = document.createElement("tr");

            // name
            const tdName = document.createElement("td");
            tdName.className = "col-name";
            tdName.title = file.name;
            tdName.textContent = file.name;
            tr.appendChild(tdName);

            // path
            const tdPath = document.createElement("td");
            tdPath.className = "col-path";
            tdPath.title = file.path;
            tdPath.textContent = file.path;
            tr.appendChild(tdPath);

            // original size
            const tdOrig = document.createElement("td");
            tdOrig.className = "col-size";
            tdOrig.textContent = formatBytes(file.originalSize);
            tr.appendChild(tdOrig);

            // new size
            const tdNew = document.createElement("td");
            tdNew.className = "col-size";
            tdNew.textContent = formatBytes(file.newSize);
            tr.appendChild(tdNew);

            // reduction
            const tdRed = document.createElement("td");
            tdRed.className = "col-size " + reductionClass;
            tdRed.textContent = reductionText;
            tr.appendChild(tdRed);

            // line reduction
            const tdLines = document.createElement("td");
            tdLines.className = "col-size";
            tdLines.textContent =
                file.originalLines && file.newLines ? file.originalLines - file.newLines : "-";
            tr.appendChild(tdLines);

            // status
            const tdStatus = document.createElement("td");
            tdStatus.className = "col-status";
            const badge = document.createElement("span");
            badge.className = "status-badge success";
            badge.textContent = "成功";
            tdStatus.appendChild(badge);
            tr.appendChild(tdStatus);

            // action
            const tdAction = document.createElement("td");
            tdAction.className = "col-action";
            const btn = document.createElement("button");
            btn.className = "btn-remove";
            btn.textContent = "移除";
            btn.dataset.index = String(index);
            tdAction.appendChild(btn);
            tr.appendChild(tdAction);

            tbody.appendChild(tr);
        }
    }

    // ============================================================
    //  IPC 通信基础设施
    // ============================================================

    const pendingIpcRequests = new Map();

    function sendIpcRequest(action, payload) {
        return new Promise((resolve, reject) => {
            const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
            pendingIpcRequests.set(id, { resolve, reject });

            try {
                window.ipc.postMessage(JSON.stringify({ id, action, payload }));
            } catch (err) {
                pendingIpcRequests.delete(id);
                reject(err);
            }

            // 30 秒超时
            setTimeout(() => {
                if (pendingIpcRequests.has(id)) {
                    pendingIpcRequests.delete(id);
                    reject(new Error("IPC 请求超时"));
                }
            }, 30000);
        });
    }

    window.__ipcHandleResponse = function (response) {
        const handler = pendingIpcRequests.get(response.id);
        if (!handler) return;
        pendingIpcRequests.delete(response.id);
        if (response.success) {
            handler.resolve(response.data);
        } else {
            handler.reject(new Error(response.error || "未知错误"));
        }
    };

    // ============================================================
    //  Actions
    // ============================================================

    function toggleSelect(index) {
        if (state.processing) return;
        if (state.selected.has(index)) {
            state.selected.delete(index);
        } else {
            state.selected.add(index);
        }
        renderPendingList();
        updateSelectAllCheckbox();
    }

    function toggleSelectAll() {
        if (state.processing) return;
        const checkbox = $("select-all-pending");
        if (checkbox.checked) {
            for (let i = 0; i < state.pending.length; i++) {
                state.selected.add(i);
            }
        } else {
            state.selected.clear();
        }
        renderPendingList();
    }

    function updateSelectAllCheckbox() {
        const checkbox = $("select-all-pending");
        checkbox.checked = state.selected.size === state.pending.length && state.pending.length > 0;
    }

    function setButtonsDisabled(disabled) {
        $("btn-add").disabled = disabled;
        $("btn-delete").disabled = disabled;
        $("btn-clear").disabled = disabled;
        $("btn-start").disabled = disabled;
        $("select-all-pending").disabled = disabled || state.pending.length === 0;
    }

    async function addFiles() {
        if (state.processing) return;
        try {
            console.log("addFiles called");
            const response = await sendIpcRequest("openFileDialog");
            console.log("addFiles response:", response);
            if (response && response.length > 0) {
                const existingPaths = [...state.pending, ...state.completed].map((f) => f.path);
                const uniqueNewFiles = response.filter((f) => !existingPaths.includes(f.path));
                state.pending.push(...uniqueNewFiles);
                state.selected.clear();
                renderPendingList();
                updateSelectAllCheckbox();
                showStatus("已添加 " + uniqueNewFiles.length + " 个文件", "success");
            }
        } catch (err) {
            console.error("addFiles error:", err);
            showStatus("添加文件失败: " + (err.message || err), "error");
        }
    }

    function deleteSelected() {
        if (state.processing) return;
        if (state.selected.size === 0) {
            showStatus("请先选择要删除的文件", "info");
            return;
        }
        const indicesToDelete = Array.from(state.selected).sort((a, b) => b - a);
        for (const idx of indicesToDelete) {
            state.pending.splice(idx, 1);
        }
        state.selected.clear();
        renderPendingList();
        updateSelectAllCheckbox();
        showStatus("已删除选中文件", "success");
    }

    function removeCompleted(index) {
        state.completed.splice(index, 1);
        renderCompletedList();
    }

    function clearAll() {
        if (state.processing) return;
        if (state.pending.length === 0 && state.completed.length === 0) return;
        if (confirm("确定要清空所有文件吗？")) {
            state.pending = [];
            state.completed = [];
            state.selected.clear();
            renderPendingList();
            renderCompletedList();
            updateSelectAllCheckbox();
            hideErrors();
            showStatus("已清空列表", "info");
        }
    }

    // ============================================================
    //  Progress / Status (called by backend via evaluateScript)
    // ============================================================

    window.updateProgress = function (current, total) {
        const percent = (current / total) * 100;
        $("progress-fill").style.width = percent + "%";
        $("progress-text").textContent = current + " / " + total;
    };

    window.updateFileStatus = function (result) {
        const pendingIndex = state.pending.findIndex((f) => f.path === result.path);

        if (result.success) {
            if (pendingIndex >= 0) {
                state.pending.splice(pendingIndex, 1);
                const newSelected = new Set();
                state.selected.forEach((idx) => {
                    if (idx < pendingIndex) newSelected.add(idx);
                    else if (idx > pendingIndex) newSelected.add(idx - 1);
                });
                state.selected = newSelected;
            }
            state.completed.unshift({
                name: result.name,
                path: result.path,
                originalSize: result.originalSize,
                newSize: result.newSize,
                originalLines: result.originalLines,
                newLines: result.newLines,
            });
        } else {
            if (pendingIndex >= 0) {
                state.pending[pendingIndex].status = "error";
                state.pending[pendingIndex].error = result.error;
            }
        }

        renderPendingList();
        renderCompletedList();
    };

    async function startProcess() {
        if (state.processing) return;
        if (state.pending.length === 0) {
            showStatus("请先添加文件", "info");
            return;
        }

        const filesToProcess = state.pending.filter((f) => f.status !== "success");
        if (filesToProcess.length === 0) {
            showStatus("没有待处理的文件", "info");
            return;
        }

        state.processing = true;
        setButtonsDisabled(true);
        hideErrors();

        const progressEl = $("progress");
        const progressFill = $("progress-fill");

        progressEl.classList.add("active");
        progressFill.style.width = "0%";
        window.updateProgress(0, filesToProcess.length);

        try {
            const response = await sendIpcRequest("processFiles", filesToProcess);

            window.updateProgress(filesToProcess.length, filesToProcess.length);

            if (response.results) {
                for (const result of response.results) {
                    const pendingIndex = state.pending.findIndex((f) => f.path === result.path);

                    if (result.success) {
                        if (pendingIndex >= 0) {
                            state.pending.splice(pendingIndex, 1);
                        }
                        state.completed.unshift({
                            name: result.name,
                            path: result.path,
                            originalSize: result.originalSize,
                            newSize: result.newSize,
                            originalLines: result.originalLines,
                            newLines: result.newLines,
                        });
                    } else {
                        if (pendingIndex >= 0) {
                            state.pending[pendingIndex].status = "error";
                            state.pending[pendingIndex].error = result.error;
                        }
                    }
                }

                renderPendingList();
                renderCompletedList();
            }

            if (response.errors && response.errors.length > 0) {
                showErrors(response.errors);
                const successCount = response.results ? response.results.filter((r) => r.success).length : 0;
                showStatus(
                    "处理完成：" + successCount + " 个成功，" + response.errors.length + " 个失败",
                    "error",
                );
            } else {
                const totalSuccess = response.results ? response.results.filter((r) => r.success).length : 0;
                showStatus("成功处理 " + totalSuccess + " 个文件！", "success");
            }
        } catch (err) {
            showStatus("处理失败: " + (err.message || err), "error");
        } finally {
            state.processing = false;
            setButtonsDisabled(false);
            state.selected.clear();
            renderPendingList();
            setTimeout(() => {
                progressEl.classList.remove("active");
                progressFill.style.width = "0%";
            }, 2000);
        }
    }

    // ============================================================
    //  Status / Errors
    // ============================================================

    function showStatus(message, type) {
        const statusEl = $("status");
        statusEl.textContent = message;
        statusEl.className = "status " + type;
        statusEl.style.display = "block";
        setTimeout(() => {
            statusEl.style.display = "none";
        }, 5000);
    }

    function showErrors(errorList) {
        const errorsEl = $("errors");
        const errorListEl = $("error-list");
        errorListEl.innerHTML = "";
        for (const err of errorList) {
            const div = document.createElement("div");
            div.className = "error-item";
            div.textContent = err;
            errorListEl.appendChild(div);
        }
        errorsEl.style.display = "block";
    }

    function hideErrors() {
        $("errors").style.display = "none";
    }

    // ============================================================
    //  Event Delegation
    // ============================================================

    function initEvents() {
        // 按钮区事件委托
        $("btn-add").addEventListener("click", addFiles);
        $("btn-delete").addEventListener("click", deleteSelected);
        $("btn-clear").addEventListener("click", clearAll);
        $("btn-start").addEventListener("click", startProcess);

        // 全选 checkbox
        $("select-all-pending").addEventListener("change", toggleSelectAll);

        // 已完成列表移除按钮事件委托
        $("completed-list").addEventListener("click", (e) => {
            const btn = e.target.closest("button.btn-remove");
            if (!btn) return;
            const index = parseInt(btn.dataset.index, 10);
            removeCompleted(index);
        });
    }

    // ============================================================
    //  Init
    // ============================================================

    renderPendingList();
    renderCompletedList();
    initEvents();
})();
