"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const package_json_1 = __importDefault(require("../../../package.json"));
const PACKAGE_NAME = package_json_1.default.name;
const PROFILE_KEY = 'i18nPanelState';
const RESOURCES_DB_ROOT = 'db://assets/resources';
const SCHEMA_FILE_NAME = '.schema.json';
const DEFAULT_LOCALE_VERSION = '1.0.0';
const CONFIRM_TIMEOUT_MS = 3000;
const TOAST_DURATION_MS = 5000;
const LOCALE_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: '.schema.json',
    title: 'i18n locale file',
    type: 'object',
    required: ['meta'],
    properties: {
        meta: {
            type: 'object',
            title: '多语言文本Meta信息',
            required: ['code'],
            properties: {
                code: {
                    type: 'string',
                    title: '多语言编码（也是多语言文件名称，图片目录名称）',
                },
                name: {
                    type: 'string',
                    title: '多语言名称',
                },
                version: {
                    type: 'string',
                    title: '多语言版本',
                },
            },
            additionalProperties: true,
        },
    },
    additionalProperties: true,
};
/** Shorthand for Editor.I18n.t with the extension's prefix and {N} interpolation. */
function t(key, ...args) {
    const fullKey = `${PACKAGE_NAME}.${key}`;
    let template;
    try {
        template = Editor.I18n.t(fullKey);
    }
    catch (_a) {
        template = key;
    }
    // Replace {0}, {1}, ... with the provided args
    if (args.length > 0) {
        return template.replace(/\{(\d+)\}/g, (match, index) => {
            const i = Number(index);
            return i < args.length ? args[i] : match;
        });
    }
    return template;
}
function isJsonObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function syncLocaleNode(baseNode, targetNode, isRoot = false) {
    const base = isJsonObject(baseNode) ? baseNode : {};
    const target = isJsonObject(targetNode) ? targetNode : {};
    const result = {};
    Object.keys(base).forEach((key) => {
        if (isRoot && key === 'meta') {
            if (Object.prototype.hasOwnProperty.call(target, 'meta')) {
                result.meta = cloneJson(target.meta);
            }
            else {
                result.meta = cloneJson(base.meta);
            }
            return;
        }
        const baseValue = base[key];
        if (!Object.prototype.hasOwnProperty.call(target, key)) {
            result[key] = cloneJson(baseValue);
            return;
        }
        const targetValue = target[key];
        if (isJsonObject(baseValue)) {
            const normalizedTargetValue = isJsonObject(targetValue) ? targetValue : {};
            result[key] = syncLocaleNode(baseValue, normalizedTargetValue);
            return;
        }
        result[key] = cloneJson(targetValue);
    });
    if (isRoot && !Object.prototype.hasOwnProperty.call(result, 'meta') && Object.prototype.hasOwnProperty.call(target, 'meta')) {
        result.meta = cloneJson(target.meta);
    }
    return result;
}
function buildSyncedLocaleContent(baseContent, targetContent) {
    const baseNode = isJsonObject(baseContent) ? baseContent : {};
    const targetNode = isJsonObject(targetContent) ? targetContent : {};
    return syncLocaleNode(baseNode, targetNode, true);
}
function normalizeDir(value) {
    return value.trim().replace(/^[\\/]+|[\\/]+$/g, '');
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function normalizeLocaleCode(value) {
    return normalizeDir(value).replace(/\.json$/i, '');
}
function createDefaultLocaleContent(code) {
    return {
        $schema: SCHEMA_FILE_NAME,
        meta: {
            code,
            version: DEFAULT_LOCALE_VERSION,
        },
    };
}
function getResourcesFsRoot() {
    return (0, path_1.join)(Editor.Project.path, 'assets', 'resources');
}
function toResourceDbPath(relativeDir) {
    const normalized = normalizeDir(relativeDir);
    return normalized ? `${RESOURCES_DB_ROOT}/${normalized}` : RESOURCES_DB_ROOT;
}
function toResourceFsPath(relativeDir) {
    const normalized = normalizeDir(relativeDir);
    return normalized ? (0, path_1.join)(getResourcesFsRoot(), normalized) : getResourcesFsRoot();
}
function toLocaleDbPath(resourceDir, fileName) {
    return `${toResourceDbPath(resourceDir)}/${fileName}`;
}
/**
 * @zh 如果希望兼容 3.3 之前的版本可以使用下方的代码
 * @en You can add the code below if you want compatibility with versions prior to 3.3
 */
// Editor.Panel.define = Editor.Panel.define || function(options: any) { return options }
module.exports = Editor.Panel.define({
    listeners: {
        show() {
            console.log('show');
        },
        hide() {
            console.log('hide');
        },
    },
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/i18n/index.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/i18n/index.css'), 'utf-8'),
    $: {
        app: '#app',
        resourceDirInput: '#resourceDirInput',
        confirmResourceDirBtn: '#confirmResourceDirBtn',
        dirTableBody: '#dirTableBody',
        newDirInput: '#newDirInput',
        addDirBtn: '#addDirBtn',
        sectionResourceDirTitle: '#sectionResourceDirTitle',
        sectionLocaleListTitle: '#sectionLocaleListTitle',
        thCode: '#thCode',
        thIsTemplate: '#thIsTemplate',
        thSetTemplate: '#thSetTemplate',
        thSync: '#thSync',
        thOpen: '#thOpen',
        thDelete: '#thDelete',
        toastContainer: '#toastContainer',
    },
    methods: {
        // ---- State helpers ----
        getDefaultState() {
            return {
                resourceDir: '',
                templateLocale: null,
            };
        },
        getState() {
            return this._state || this.getDefaultState();
        },
        getLocaleEntries() {
            return this._localeEntries || [];
        },
        // ---- Confirm state helpers (delayed double-click pattern) ----
        getConfirmState() {
            return this._confirmState || null;
        },
        setConfirmState(state) {
            this._confirmState = state;
        },
        clearConfirmState() {
            const current = this.getConfirmState();
            if (current) {
                clearTimeout(current.timerId);
                this.setConfirmState(null);
            }
        },
        armConfirmState(rowIndex, action) {
            this.clearConfirmState();
            const timerId = setTimeout(() => {
                this.setConfirmState(null);
                this.render();
            }, CONFIRM_TIMEOUT_MS);
            this.setConfirmState({ rowIndex, action, timerId });
            this.render();
        },
        // ---- Toast notifications (auto-dismiss after 5s) ----
        addLog(level, message) {
            const container = this.$.toastContainer;
            if (!container) {
                return;
            }
            const toast = document.createElement('div');
            toast.className = `toast-item toast-${level}`;
            toast.textContent = message;
            container.appendChild(toast);
            // Remove from DOM after animation finishes (toast-out starts at 4.5s, lasts 0.3s)
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, TOAST_DURATION_MS);
        },
        // ---- Template locale normalization ----
        normalizeTemplateLocale(templateLocale) {
            if (!templateLocale || typeof templateLocale !== 'object') {
                return null;
            }
            const fileName = String(templateLocale.fileName || '').trim();
            const content = templateLocale.content;
            if (!fileName || !content || typeof content !== 'object' || Array.isArray(content)) {
                return null;
            }
            return {
                fileName,
                content: cloneJson(content),
            };
        },
        normalizeState(state) {
            const defaultState = this.getDefaultState();
            const resourceDir = normalizeDir((state === null || state === void 0 ? void 0 : state.resourceDir) || defaultState.resourceDir);
            return {
                resourceDir,
                templateLocale: this.normalizeTemplateLocale(state === null || state === void 0 ? void 0 : state.templateLocale),
            };
        },
        async loadState() {
            try {
                const state = await Editor.Profile.getProject(PACKAGE_NAME, PROFILE_KEY);
                this._state = this.normalizeState(state);
            }
            catch (error) {
                console.warn(`[${PACKAGE_NAME}]`, t('log_profile_load_failed'), error);
                this._state = this.getDefaultState();
            }
        },
        saveState(state) {
            const normalizedState = this.normalizeState(state);
            this._state = normalizedState;
            void Editor.Profile.setProject(PACKAGE_NAME, PROFILE_KEY, normalizedState, 'project').catch((error) => {
                console.warn(`[${PACKAGE_NAME}]`, t('log_profile_save_failed'), error);
            });
        },
        getResourceDir() {
            const input = this.$.resourceDirInput;
            return normalizeDir((input === null || input === void 0 ? void 0 : input.value) || '');
        },
        async existsInResourcesDb(relativeDir) {
            const normalized = normalizeDir(relativeDir);
            if (!normalized) {
                return false;
            }
            try {
                const info = await Editor.Message.request('asset-db', 'query-asset-info', toResourceDbPath(normalized));
                return Boolean(info);
            }
            catch (error) {
                console.warn(`[${PACKAGE_NAME}]`, t('log_asset_db_query_failed'), error);
                return (0, fs_extra_1.pathExists)(toResourceFsPath(normalized));
            }
        },
        async refreshResourcesAssetDb() {
            try {
                await Editor.Message.request('asset-db', 'refresh-asset', RESOURCES_DB_ROOT);
            }
            catch (error) {
                console.warn(`[${PACKAGE_NAME}]`, t('log_asset_db_refresh_failed'), error);
            }
        },
        async ensureResourceDirCreated(relativeDir) {
            const normalized = normalizeDir(relativeDir);
            if (!normalized) {
                return;
            }
            const resourcesFsRoot = getResourcesFsRoot();
            const resourcesExists = await (0, fs_extra_1.pathExists)(resourcesFsRoot);
            if (!resourcesExists) {
                await (0, fs_extra_1.ensureDir)(resourcesFsRoot);
            }
            await (0, fs_extra_1.ensureDir)(toResourceFsPath(normalized));
        },
        async ensureSchemaFile(relativeDir) {
            const normalized = normalizeDir(relativeDir);
            if (!normalized) {
                return;
            }
            const dirPath = toResourceFsPath(normalized);
            await (0, fs_extra_1.ensureDir)(dirPath);
            const schemaPath = (0, path_1.join)(dirPath, SCHEMA_FILE_NAME);
            const schemaExists = await (0, fs_extra_1.pathExists)(schemaPath);
            if (schemaExists) {
                return;
            }
            await (0, fs_extra_1.writeJson)(schemaPath, LOCALE_SCHEMA, { spaces: 2 });
            const created = await (0, fs_extra_1.pathExists)(schemaPath);
            if (!created) {
                this.addLog('error', t('op_schema_missing', schemaPath));
                throw new Error(`[${PACKAGE_NAME}] ${t('log_schema_create_failed', schemaPath)}`);
            }
            this.addLog('success', t('op_schema_created'));
            console.log(`[${PACKAGE_NAME}]`, t('log_schema_created', schemaPath));
        },
        async transferResourceDir(oldDir, newDir) {
            const oldNormalized = normalizeDir(oldDir);
            const newNormalized = normalizeDir(newDir);
            if (!oldNormalized || !newNormalized || oldNormalized === newNormalized) {
                return;
            }
            const oldPath = toResourceFsPath(oldNormalized);
            const newPath = toResourceFsPath(newNormalized);
            const oldExists = await (0, fs_extra_1.pathExists)(oldPath);
            if (!oldExists) {
                throw new Error(`原目录不存在: ${oldPath}`);
            }
            const newExists = await (0, fs_extra_1.pathExists)(newPath);
            if (newExists) {
                throw new Error(`目标目录已存在: ${newPath}`);
            }
            await (0, fs_extra_1.move)(oldPath, newPath);
        },
        async listLocaleEntries(relativeDir) {
            const normalized = normalizeDir(relativeDir);
            if (!normalized) {
                return [];
            }
            const dirPath = toResourceFsPath(normalized);
            const exists = await (0, fs_extra_1.pathExists)(dirPath);
            if (!exists) {
                return [];
            }
            const fileNames = (await (0, fs_extra_1.readdir)(dirPath))
                .filter((fileName) => fileName.endsWith('.json') && fileName !== SCHEMA_FILE_NAME)
                .sort((left, right) => left.localeCompare(right, 'zh-CN'));
            return fileNames.map((fileName) => ({
                fileName,
                code: fileName.replace(/\.json$/i, ''),
                fullPath: (0, path_1.join)(dirPath, fileName),
                dbPath: toLocaleDbPath(normalized, fileName),
            }));
        },
        async readLocaleJson(filePath) {
            const content = await (0, fs_extra_1.readJson)(filePath);
            if (!content || typeof content !== 'object' || Array.isArray(content)) {
                return {};
            }
            return content;
        },
        async syncTemplateLocale(entries) {
            var _a;
            const state = this.getState();
            const templateFileName = ((_a = state.templateLocale) === null || _a === void 0 ? void 0 : _a.fileName) || '';
            const existingTemplate = templateFileName ? entries.find((entry) => entry.fileName === templateFileName) : undefined;
            if (!entries.length) {
                if (state.templateLocale) {
                    state.templateLocale = null;
                    this.saveState(state);
                }
                return;
            }
            if (existingTemplate) {
                return;
            }
            const firstEntry = entries[0];
            const firstContent = await this.readLocaleJson(firstEntry.fullPath);
            state.templateLocale = {
                fileName: firstEntry.fileName,
                content: cloneJson(firstContent),
            };
            this.saveState(state);
        },
        async refreshLocaleEntries() {
            const resourceDir = this.getState().resourceDir;
            if (resourceDir) {
                await this.ensureSchemaFile(resourceDir);
            }
            const entries = await this.listLocaleEntries(resourceDir);
            this._localeEntries = entries;
            await this.syncTemplateLocale(entries);
        },
        async getTemplateContent(entries) {
            var _a;
            const state = this.getState();
            const templateFileName = ((_a = state.templateLocale) === null || _a === void 0 ? void 0 : _a.fileName) || '';
            let templateEntry;
            if (templateFileName) {
                templateEntry = entries.find((entry) => entry.fileName === templateFileName);
            }
            if (!templateEntry && entries.length) {
                templateEntry = entries[0];
            }
            if (!templateEntry) {
                return createDefaultLocaleContent('');
            }
            // Always read from the template locale file to avoid using stale cached content.
            const templateContent = cloneJson(await this.readLocaleJson(templateEntry.fullPath));
            state.templateLocale = {
                fileName: templateEntry.fileName,
                content: cloneJson(templateContent),
            };
            this.saveState(state);
            return templateContent;
        },
        async updateConfirmButtonMode() {
            const button = this.$.confirmResourceDirBtn;
            if (!button) {
                return;
            }
            const state = this.getState();
            const savedDir = normalizeDir(state.resourceDir);
            const savedDirExists = savedDir ? await this.existsInResourcesDb(savedDir) : false;
            const mode = savedDirExists ? 'transfer' : 'add';
            this._confirmMode = mode;
            button.textContent = mode === 'transfer' ? t('btn_transfer') : t('btn_add');
        },
        // ---- Localize static UI text ----
        localizeStaticText() {
            const sectionResourceDirTitle = this.$.sectionResourceDirTitle;
            const sectionLocaleListTitle = this.$.sectionLocaleListTitle;
            const resourceDirInput = this.$.resourceDirInput;
            const newDirInput = this.$.newDirInput;
            const addDirBtn = this.$.addDirBtn;
            const thCode = this.$.thCode;
            const thIsTemplate = this.$.thIsTemplate;
            const thSetTemplate = this.$.thSetTemplate;
            const thSync = this.$.thSync;
            const thOpen = this.$.thOpen;
            const thDelete = this.$.thDelete;
            if (sectionResourceDirTitle)
                sectionResourceDirTitle.textContent = t('section_resource_dir');
            if (sectionLocaleListTitle)
                sectionLocaleListTitle.textContent = t('section_locale_list');
            if (resourceDirInput)
                resourceDirInput.placeholder = t('input_resource_dir_placeholder');
            if (newDirInput)
                newDirInput.placeholder = t('input_new_dir_placeholder');
            if (addDirBtn)
                addDirBtn.textContent = t('btn_add_locale');
            if (thCode)
                thCode.textContent = t('table_header_code');
            if (thIsTemplate)
                thIsTemplate.textContent = t('table_header_is_template');
            if (thSetTemplate)
                thSetTemplate.textContent = t('table_header_set_template');
            if (thSync)
                thSync.textContent = t('table_header_sync');
            if (thOpen)
                thOpen.textContent = t('table_header_open');
            if (thDelete)
                thDelete.textContent = t('table_header_delete');
        },
        renderDirectoryTable(entries) {
            var _a;
            const tableBody = this.$.dirTableBody;
            if (!tableBody) {
                return;
            }
            if (!entries.length) {
                tableBody.innerHTML = `<tr><td colspan="6" class="empty-tip">${escapeHtml(t('empty_tip'))}</td></tr>`;
                return;
            }
            const templateFileName = ((_a = this.getState().templateLocale) === null || _a === void 0 ? void 0 : _a.fileName) || '';
            const hasMultipleEntries = entries.length > 1;
            const confirmState = this.getConfirmState();
            tableBody.innerHTML = entries
                .map((entry, index) => {
                const isTemplate = entry.fileName === templateFileName;
                const canSync = hasMultipleEntries && isTemplate;
                // Determine delete button rendering
                let deleteBtnHtml;
                if (confirmState && confirmState.rowIndex === index && confirmState.action === 'delete') {
                    deleteBtnHtml = `<button class="table-action-btn table-action-btn-confirm" type="button" data-action="confirm-delete" data-index="${index}">${escapeHtml(t('btn_confirm_delete'))}</button>`;
                }
                else {
                    deleteBtnHtml = `<button class="table-action-btn table-action-btn-danger" type="button" data-action="delete" data-index="${index}">${escapeHtml(t('btn_delete'))}</button>`;
                }
                // Determine sync button rendering
                let syncBtnHtml;
                if (confirmState && confirmState.rowIndex === index && confirmState.action === 'sync') {
                    syncBtnHtml = `<button class="table-action-btn table-action-btn-confirm" type="button" data-action="confirm-sync" data-index="${index}" ${canSync ? '' : 'disabled'}>${escapeHtml(t('btn_confirm_sync'))}</button>`;
                }
                else {
                    syncBtnHtml = `<button class="table-action-btn" type="button" data-action="sync" data-index="${index}" ${canSync ? '' : 'disabled'}>${escapeHtml(t('btn_sync'))}</button>`;
                }
                return (`<tr>
                            <td>${escapeHtml(entry.code)}</td>
                            <td><span class="${isTemplate ? 'template-flag-yes' : 'template-flag-no'}">${isTemplate ? escapeHtml(t('template_yes')) : escapeHtml(t('template_no'))}</span></td>
                            <td><button class="table-action-btn" type="button" data-action="set-template" data-index="${index}" ${isTemplate ? 'disabled' : ''}>${isTemplate ? escapeHtml(t('btn_current_template')) : escapeHtml(t('btn_set_template'))}</button></td>
                            <td>${syncBtnHtml}</td>
                            <td><button class="table-action-btn" type="button" data-action="open" data-index="${index}">${escapeHtml(t('btn_open'))}</button></td>
                            <td>${deleteBtnHtml}</td>
                        </tr>`);
            })
                .join('');
        },
        render() {
            const state = this.getState();
            const resourceDirInput = this.$.resourceDirInput;
            const newDirInput = this.$.newDirInput;
            if (resourceDirInput) {
                resourceDirInput.value = state.resourceDir;
            }
            if (newDirInput) {
                newDirInput.value = '';
            }
            this.renderDirectoryTable(this.getLocaleEntries());
            void this.updateConfirmButtonMode();
        },
        async handleConfirmResourceDir() {
            const state = this.getState();
            const resourceDir = this.getResourceDir();
            if (!resourceDir) {
                console.warn(`[${PACKAGE_NAME}]`, t('log_enter_resource_dir'));
                return;
            }
            const mode = this._confirmMode || 'add';
            try {
                if (mode === 'transfer') {
                    await this.transferResourceDir(state.resourceDir, resourceDir);
                    this.addLog('success', t('op_dir_transferred', state.resourceDir, resourceDir));
                    console.log(`[${PACKAGE_NAME}]`, t('log_dir_transferred', state.resourceDir, resourceDir));
                }
                else {
                    await this.ensureResourceDirCreated(resourceDir);
                    this.addLog('success', t('op_dir_added', toResourceDbPath(resourceDir)));
                    console.log(`[${PACKAGE_NAME}]`, t('log_dir_added', toResourceDbPath(resourceDir)));
                }
                await this.ensureSchemaFile(resourceDir);
                const schemaPath = (0, path_1.join)(toResourceFsPath(resourceDir), SCHEMA_FILE_NAME);
                const schemaExists = await (0, fs_extra_1.pathExists)(schemaPath);
                if (!schemaExists) {
                    this.addLog('error', t('op_schema_missing', schemaPath));
                    throw new Error(`[${PACKAGE_NAME}] ${t('log_schema_missing', schemaPath)}`);
                }
                this.addLog('success', t('op_schema_verified', schemaPath));
                console.log(`[${PACKAGE_NAME}]`, t('log_schema_verified', schemaPath));
                state.resourceDir = resourceDir;
                this.saveState(state);
                await this.refreshResourcesAssetDb();
                await this.refreshLocaleEntries();
                this.render();
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                this.addLog('error', t('op_set_dir_failed', errMsg));
                console.warn(`[${PACKAGE_NAME}]`, t('log_set_dir_failed'), error);
            }
        },
        async handleAddDirectory() {
            const newDirInput = this.$.newDirInput;
            if (!newDirInput) {
                return;
            }
            const resourceDir = this.getState().resourceDir || this.getResourceDir();
            if (!resourceDir) {
                console.warn(`[${PACKAGE_NAME}]`, t('log_configure_dir_first'));
                return;
            }
            const localeCode = normalizeLocaleCode(newDirInput.value || '');
            if (!localeCode) {
                return;
            }
            try {
                await this.ensureResourceDirCreated(resourceDir);
                await this.ensureSchemaFile(resourceDir);
                const localeFileName = `${localeCode}.json`;
                const localeFilePath = (0, path_1.join)(toResourceFsPath(resourceDir), localeFileName);
                const exists = await (0, fs_extra_1.pathExists)(localeFilePath);
                if (exists) {
                    newDirInput.value = '';
                    this.addLog('warn', t('op_locale_exists', localeFileName));
                    console.warn(`[${PACKAGE_NAME}]`, t('log_locale_exists', localeFileName));
                    return;
                }
                const entries = await this.listLocaleEntries(resourceDir);
                const localeContent = !entries.length
                    ? createDefaultLocaleContent(localeCode)
                    : await this.getTemplateContent(entries);
                localeContent.$schema = SCHEMA_FILE_NAME;
                if (!localeContent.meta || typeof localeContent.meta !== 'object' || Array.isArray(localeContent.meta)) {
                    localeContent.meta = {};
                }
                localeContent.meta.code = localeCode;
                if (!localeContent.meta.version) {
                    localeContent.meta.version = DEFAULT_LOCALE_VERSION;
                }
                await (0, fs_extra_1.writeJson)(localeFilePath, localeContent, { spaces: 2 });
                await this.refreshResourcesAssetDb();
                await this.refreshLocaleEntries();
                this.addLog('success', t('op_locale_added', localeCode));
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                this.addLog('error', t('op_add_locale_failed', errMsg));
                console.warn(`[${PACKAGE_NAME}]`, t('log_add_locale_failed'), error);
            }
            this.render();
        },
        async setTemplate(index) {
            const entry = this.getLocaleEntries()[index];
            if (!entry) {
                return;
            }
            const content = await this.readLocaleJson(entry.fullPath);
            const state = this.getState();
            state.templateLocale = {
                fileName: entry.fileName,
                content: cloneJson(content),
            };
            this.saveState(state);
            this.addLog('info', t('op_template_set', entry.code));
            this.render();
        },
        // ---- Sync (delayed confirm) ----
        async executeSync(index) {
            const entries = this.getLocaleEntries();
            const baseEntry = entries[index];
            if (!baseEntry) {
                return;
            }
            const targetEntries = entries.filter((_, entryIndex) => entryIndex !== index);
            if (!targetEntries.length) {
                this.addLog('warn', t('sync_no_targets'));
                console.warn(`[${PACKAGE_NAME}]`, t('sync_no_targets'));
                return;
            }
            const baseContent = await this.readLocaleJson(baseEntry.fullPath);
            let changedCount = 0;
            for (const targetEntry of targetEntries) {
                try {
                    const targetContent = await this.readLocaleJson(targetEntry.fullPath);
                    const syncedContent = buildSyncedLocaleContent(baseContent, targetContent);
                    if (JSON.stringify(targetContent) === JSON.stringify(syncedContent)) {
                        continue;
                    }
                    await (0, fs_extra_1.writeJson)(targetEntry.fullPath, syncedContent, { spaces: 2 });
                    changedCount += 1;
                }
                catch (error) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    this.addLog('warn', t('op_sync_failed', targetEntry.fileName, errMsg));
                    console.warn(`[${PACKAGE_NAME}]`, t('log_sync_failed', targetEntry.fileName), error);
                }
            }
            await this.refreshResourcesAssetDb();
            await this.refreshLocaleEntries();
            this.render();
            this.addLog('success', t('op_sync_complete', baseEntry.fileName, String(changedCount)));
            console.log(`[${PACKAGE_NAME}]`, t('log_sync_complete', baseEntry.fileName, String(changedCount)));
        },
        async openDirectory(index) {
            var _a, _b;
            const entry = this.getLocaleEntries()[index];
            if (!entry) {
                return;
            }
            try {
                await Editor.Message.request('asset-db', 'open-asset', entry.dbPath);
                return;
            }
            catch (error) {
                console.warn(`[${PACKAGE_NAME}]`, t('log_open_asset_failed'), error);
            }
            try {
                const electron = require('electron');
                if ((_a = electron === null || electron === void 0 ? void 0 : electron.shell) === null || _a === void 0 ? void 0 : _a.openPath) {
                    electron.shell.openPath(entry.fullPath);
                    return;
                }
            }
            catch (error) {
                console.warn(`[${PACKAGE_NAME}]`, t('log_electron_unavailable'), error);
            }
            if ((_b = Editor.Shell) === null || _b === void 0 ? void 0 : _b.openPath) {
                Editor.Shell.openPath(entry.fullPath);
                return;
            }
            this.addLog('warn', t('op_open_failed', entry.fileName));
            console.warn(`[${PACKAGE_NAME}]`, t('log_cannot_open', entry.fullPath));
        },
        // ---- Delete (delayed confirm) ----
        async executeDelete(index) {
            const entry = this.getLocaleEntries()[index];
            if (!entry) {
                return;
            }
            const code = entry.code;
            await (0, fs_extra_1.remove)(entry.fullPath);
            await this.refreshResourcesAssetDb();
            await this.refreshLocaleEntries();
            this.addLog('success', t('op_delete_complete', code));
            this.render();
        },
        // ---- Event binding ----
        bindEvents() {
            const confirmBtn = this.$.confirmResourceDirBtn;
            const addBtn = this.$.addDirBtn;
            const newDirInput = this.$.newDirInput;
            const dirTableBody = this.$.dirTableBody;
            const resourceDirInput = this.$.resourceDirInput;
            confirmBtn === null || confirmBtn === void 0 ? void 0 : confirmBtn.addEventListener('click', () => {
                void this.handleConfirmResourceDir();
            });
            addBtn === null || addBtn === void 0 ? void 0 : addBtn.addEventListener('click', () => {
                void this.handleAddDirectory();
            });
            resourceDirInput === null || resourceDirInput === void 0 ? void 0 : resourceDirInput.addEventListener('blur', () => {
                void this.updateConfirmButtonMode();
            });
            newDirInput === null || newDirInput === void 0 ? void 0 : newDirInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    void this.handleAddDirectory();
                }
            });
            dirTableBody === null || dirTableBody === void 0 ? void 0 : dirTableBody.addEventListener('click', (event) => {
                const target = event.target;
                const button = target === null || target === void 0 ? void 0 : target.closest('button[data-action][data-index]');
                if (!button || button.disabled) {
                    return;
                }
                const action = button.dataset.action;
                const index = Number(button.dataset.index);
                if (Number.isNaN(index)) {
                    return;
                }
                // Actions that don't need confirmation
                if (action === 'open') {
                    void this.openDirectory(index);
                    return;
                }
                if (action === 'set-template') {
                    void this.setTemplate(index);
                    return;
                }
                // ---- Delayed-confirm actions ----
                // Clicking a confirm-state button → execute immediately
                if (action === 'confirm-delete') {
                    this.clearConfirmState();
                    void this.executeDelete(index);
                    return;
                }
                if (action === 'confirm-sync') {
                    this.clearConfirmState();
                    void this.executeSync(index);
                    return;
                }
                // Clicking "delete" or "sync" for the first time → arm confirm state
                if (action === 'delete') {
                    this.armConfirmState(index, 'delete');
                    return;
                }
                if (action === 'sync') {
                    this.armConfirmState(index, 'sync');
                }
            });
            // Clicking outside the table (or anywhere on the panel) clears confirm state
            const app = this.$.app;
            app === null || app === void 0 ? void 0 : app.addEventListener('click', (event) => {
                const target = event.target;
                // Only clear if clicking outside a confirm-action button
                const isConfirmButton = target === null || target === void 0 ? void 0 : target.closest('[data-action="confirm-delete"], [data-action="confirm-sync"], [data-action="delete"], [data-action="sync"]');
                if (!isConfirmButton) {
                    this.clearConfirmState();
                    this.render();
                }
            });
        },
        async initializePanel() {
            this.localizeStaticText();
            this.bindEvents();
            await this.loadState();
            await this.refreshLocaleEntries();
            this.render();
        },
    },
    ready() {
        void this.initializePanel();
    },
    beforeClose() { },
    close() { },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL2kxOG4vaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1Q0FBMkc7QUFDM0csK0JBQTRCO0FBQzVCLHlFQUFnRDtBQUVoRCxNQUFNLFlBQVksR0FBRyxzQkFBVyxDQUFDLElBQUksQ0FBQztBQUN0QyxNQUFNLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQztBQUNyQyxNQUFNLGlCQUFpQixHQUFHLHVCQUF1QixDQUFDO0FBQ2xELE1BQU0sZ0JBQWdCLEdBQUcsY0FBYyxDQUFDO0FBQ3hDLE1BQU0sc0JBQXNCLEdBQUcsT0FBTyxDQUFDO0FBQ3ZDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0FBQ2hDLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDO0FBSS9CLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLE9BQU8sRUFBRSw4Q0FBOEM7SUFDdkQsR0FBRyxFQUFFLGNBQWM7SUFDbkIsS0FBSyxFQUFFLGtCQUFrQjtJQUN6QixJQUFJLEVBQUUsUUFBUTtJQUNkLFFBQVEsRUFBRSxDQUFDLE1BQU0sQ0FBQztJQUNsQixVQUFVLEVBQUU7UUFDUixJQUFJLEVBQUU7WUFDRixJQUFJLEVBQUUsUUFBUTtZQUNkLEtBQUssRUFBRSxhQUFhO1lBQ3BCLFFBQVEsRUFBRSxDQUFDLE1BQU0sQ0FBQztZQUNsQixVQUFVLEVBQUU7Z0JBQ1IsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLEtBQUssRUFBRSx5QkFBeUI7aUJBQ25DO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxLQUFLLEVBQUUsT0FBTztpQkFDakI7Z0JBQ0QsT0FBTyxFQUFFO29CQUNMLElBQUksRUFBRSxRQUFRO29CQUNkLEtBQUssRUFBRSxPQUFPO2lCQUNqQjthQUNKO1lBQ0Qsb0JBQW9CLEVBQUUsSUFBSTtTQUM3QjtLQUNKO0lBQ0Qsb0JBQW9CLEVBQUUsSUFBSTtDQUM3QixDQUFDO0FBK0JGLHFGQUFxRjtBQUNyRixTQUFTLENBQUMsQ0FBQyxHQUFXLEVBQUUsR0FBRyxJQUFjO0lBQ3JDLE1BQU0sT0FBTyxHQUFHLEdBQUcsWUFBWSxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ3pDLElBQUksUUFBZ0IsQ0FBQztJQUNyQixJQUFJLENBQUM7UUFDRCxRQUFRLEdBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFTLENBQUMsT0FBTyxDQUFXLENBQUM7SUFDekQsQ0FBQztJQUFDLFdBQU0sQ0FBQztRQUNMLFFBQVEsR0FBRyxHQUFHLENBQUM7SUFDbkIsQ0FBQztJQUNELCtDQUErQztJQUMvQyxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDbEIsT0FBTyxRQUFRLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUNuRCxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDeEIsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDN0MsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBQ0QsT0FBTyxRQUFRLENBQUM7QUFDcEIsQ0FBQztBQUVELFNBQVMsWUFBWSxDQUFDLEtBQVU7SUFDNUIsT0FBTyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNoRixDQUFDO0FBRUQsU0FBUyxjQUFjLENBQUMsUUFBb0IsRUFBRSxVQUFzQixFQUFFLE1BQU0sR0FBRyxLQUFLO0lBQ2hGLE1BQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDcEQsTUFBTSxNQUFNLEdBQUcsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUMxRCxNQUFNLE1BQU0sR0FBZSxFQUFFLENBQUM7SUFFOUIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUM5QixJQUFJLE1BQU0sSUFBSSxHQUFHLEtBQUssTUFBTSxFQUFFLENBQUM7WUFDM0IsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBQ3ZELE1BQU0sQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN6QyxDQUFDO2lCQUFNLENBQUM7Z0JBQ0osTUFBTSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7WUFDRCxPQUFPO1FBQ1gsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM1QixJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3JELE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDbkMsT0FBTztRQUNYLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEMsSUFBSSxZQUFZLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztZQUMxQixNQUFNLHFCQUFxQixHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDM0UsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxTQUFTLEVBQUUscUJBQXFCLENBQUMsQ0FBQztZQUMvRCxPQUFPO1FBQ1gsQ0FBQztRQUVELE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDekMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQzFILE1BQU0sQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDbEIsQ0FBQztBQUVELFNBQVMsd0JBQXdCLENBQUMsV0FBdUIsRUFBRSxhQUF5QjtJQUNoRixNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQzlELE1BQU0sVUFBVSxHQUFHLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFFcEUsT0FBTyxjQUFjLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN0RCxDQUFDO0FBRUQsU0FBUyxZQUFZLENBQUMsS0FBYTtJQUMvQixPQUFPLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDeEQsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEtBQWE7SUFDN0IsT0FBTyxLQUFLO1NBQ1AsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUM7U0FDdEIsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUM7U0FDckIsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUM7U0FDckIsT0FBTyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUM7U0FDdkIsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQsU0FBUyxTQUFTLENBQUksS0FBUTtJQUMxQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUFDLEtBQWE7SUFDdEMsT0FBTyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUN2RCxDQUFDO0FBRUQsU0FBUywwQkFBMEIsQ0FBQyxJQUFZO0lBQzVDLE9BQU87UUFDSCxPQUFPLEVBQUUsZ0JBQWdCO1FBQ3pCLElBQUksRUFBRTtZQUNGLElBQUk7WUFDSixPQUFPLEVBQUUsc0JBQXNCO1NBQ2xDO0tBQ0osQ0FBQztBQUNOLENBQUM7QUFFRCxTQUFTLGtCQUFrQjtJQUN2QixPQUFPLElBQUEsV0FBSSxFQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztBQUM1RCxDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxXQUFtQjtJQUN6QyxNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDN0MsT0FBTyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsaUJBQWlCLElBQUksVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDO0FBQ2pGLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFdBQW1CO0lBQ3pDLE1BQU0sVUFBVSxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM3QyxPQUFPLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBQSxXQUFJLEVBQUMsa0JBQWtCLEVBQUUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztBQUN0RixDQUFDO0FBRUQsU0FBUyxjQUFjLENBQUMsV0FBbUIsRUFBRSxRQUFnQjtJQUN6RCxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLElBQUksUUFBUSxFQUFFLENBQUM7QUFDMUQsQ0FBQztBQUNEOzs7R0FHRztBQUNILHlGQUF5RjtBQUN6RixNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQ2pDLFNBQVMsRUFBRTtRQUNQLElBQUk7WUFDQSxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3hCLENBQUM7UUFDRCxJQUFJO1lBQ0EsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN4QixDQUFDO0tBQ0o7SUFDRCxRQUFRLEVBQUUsSUFBQSx1QkFBWSxFQUFDLElBQUEsV0FBSSxFQUFDLFNBQVMsRUFBRSwwQ0FBMEMsQ0FBQyxFQUFFLE9BQU8sQ0FBQztJQUM1RixLQUFLLEVBQUUsSUFBQSx1QkFBWSxFQUFDLElBQUEsV0FBSSxFQUFDLFNBQVMsRUFBRSxzQ0FBc0MsQ0FBQyxFQUFFLE9BQU8sQ0FBQztJQUNyRixDQUFDLEVBQUU7UUFDQyxHQUFHLEVBQUUsTUFBTTtRQUNYLGdCQUFnQixFQUFFLG1CQUFtQjtRQUNyQyxxQkFBcUIsRUFBRSx3QkFBd0I7UUFDL0MsWUFBWSxFQUFFLGVBQWU7UUFDN0IsV0FBVyxFQUFFLGNBQWM7UUFDM0IsU0FBUyxFQUFFLFlBQVk7UUFDdkIsdUJBQXVCLEVBQUUsMEJBQTBCO1FBQ25ELHNCQUFzQixFQUFFLHlCQUF5QjtRQUNqRCxNQUFNLEVBQUUsU0FBUztRQUNqQixZQUFZLEVBQUUsZUFBZTtRQUM3QixhQUFhLEVBQUUsZ0JBQWdCO1FBQy9CLE1BQU0sRUFBRSxTQUFTO1FBQ2pCLE1BQU0sRUFBRSxTQUFTO1FBQ2pCLFFBQVEsRUFBRSxXQUFXO1FBQ3JCLGNBQWMsRUFBRSxpQkFBaUI7S0FDcEM7SUFDRCxPQUFPLEVBQUU7UUFDTCwwQkFBMEI7UUFDMUIsZUFBZTtZQUNYLE9BQU87Z0JBQ0gsV0FBVyxFQUFFLEVBQUU7Z0JBQ2YsY0FBYyxFQUFFLElBQUk7YUFDdkIsQ0FBQztRQUNOLENBQUM7UUFDRCxRQUFRO1lBQ0osT0FBUyxJQUFZLENBQUMsTUFBeUIsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDOUUsQ0FBQztRQUNELGdCQUFnQjtZQUNaLE9BQVMsSUFBWSxDQUFDLGNBQW9DLElBQUksRUFBRSxDQUFDO1FBQ3JFLENBQUM7UUFFRCxpRUFBaUU7UUFDakUsZUFBZTtZQUNYLE9BQVMsSUFBWSxDQUFDLGFBQThCLElBQUksSUFBSSxDQUFDO1FBQ2pFLENBQUM7UUFDRCxlQUFlLENBQUMsS0FBMEI7WUFDckMsSUFBWSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7UUFDeEMsQ0FBQztRQUNELGlCQUFpQjtZQUNiLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN2QyxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUNWLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0IsQ0FBQztRQUNMLENBQUM7UUFDRCxlQUFlLENBQUMsUUFBZ0IsRUFBRSxNQUFxQjtZQUNuRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUN6QixNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFO2dCQUM1QixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMzQixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEIsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUNwRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDbEIsQ0FBQztRQUVELHdEQUF3RDtRQUN4RCxNQUFNLENBQUMsS0FBaUIsRUFBRSxPQUFlO1lBQ3JDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBb0MsQ0FBQztZQUM5RCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2IsT0FBTztZQUNYLENBQUM7WUFFRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzVDLEtBQUssQ0FBQyxTQUFTLEdBQUcsb0JBQW9CLEtBQUssRUFBRSxDQUFDO1lBQzlDLEtBQUssQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDO1lBQzVCLFNBQVMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFN0Isa0ZBQWtGO1lBQ2xGLFVBQVUsQ0FBQyxHQUFHLEVBQUU7Z0JBQ1osSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQ25CLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDbkIsQ0FBQztZQUNMLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQzFCLENBQUM7UUFFRCwwQ0FBMEM7UUFDMUMsdUJBQXVCLENBQUMsY0FBaUQ7WUFDckUsSUFBSSxDQUFDLGNBQWMsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLEVBQUUsQ0FBQztnQkFDeEQsT0FBTyxJQUFJLENBQUM7WUFDaEIsQ0FBQztZQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxjQUFjLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzlELE1BQU0sT0FBTyxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUM7WUFDdkMsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNqRixPQUFPLElBQUksQ0FBQztZQUNoQixDQUFDO1lBRUQsT0FBTztnQkFDSCxRQUFRO2dCQUNSLE9BQU8sRUFBRSxTQUFTLENBQUMsT0FBTyxDQUFDO2FBQzlCLENBQUM7UUFDTixDQUFDO1FBQ0QsY0FBYyxDQUFDLEtBQWlEO1lBQzVELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUM1QyxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsQ0FBQSxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsV0FBVyxLQUFJLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUVqRixPQUFPO2dCQUNILFdBQVc7Z0JBQ1gsY0FBYyxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsY0FBYyxDQUFDO2FBQ3RFLENBQUM7UUFDTixDQUFDO1FBQ0QsS0FBSyxDQUFDLFNBQVM7WUFDWCxJQUFJLENBQUM7Z0JBQ0QsTUFBTSxLQUFLLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLENBQUM7Z0JBQ3hFLElBQVksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFnQyxDQUFDLENBQUM7WUFDakYsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2IsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN0RSxJQUFZLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNsRCxDQUFDO1FBQ0wsQ0FBQztRQUNELFNBQVMsQ0FBQyxLQUFxQjtZQUMzQixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2xELElBQVksQ0FBQyxNQUFNLEdBQUcsZUFBZSxDQUFDO1lBRXZDLEtBQUssTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ2xHLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMseUJBQXlCLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMzRSxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7UUFDRCxjQUFjO1lBQ1YsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxnQkFBMkMsQ0FBQztZQUNqRSxPQUFPLFlBQVksQ0FBQyxDQUFBLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxLQUFLLEtBQUksRUFBRSxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxXQUFtQjtZQUN6QyxNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNkLE9BQU8sS0FBSyxDQUFDO1lBQ2pCLENBQUM7WUFFRCxJQUFJLENBQUM7Z0JBQ0QsTUFBTSxJQUFJLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDeEcsT0FBTyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDekIsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2IsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQywyQkFBMkIsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN6RSxPQUFPLElBQUEscUJBQVUsRUFBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ3BELENBQUM7UUFDTCxDQUFDO1FBQ0QsS0FBSyxDQUFDLHVCQUF1QjtZQUN6QixJQUFJLENBQUM7Z0JBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDakYsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2IsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQy9FLENBQUM7UUFDTCxDQUFDO1FBQ0QsS0FBSyxDQUFDLHdCQUF3QixDQUFDLFdBQW1CO1lBQzlDLE1BQU0sVUFBVSxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUM3QyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ2QsT0FBTztZQUNYLENBQUM7WUFFRCxNQUFNLGVBQWUsR0FBRyxrQkFBa0IsRUFBRSxDQUFDO1lBQzdDLE1BQU0sZUFBZSxHQUFHLE1BQU0sSUFBQSxxQkFBVSxFQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzFELElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDbkIsTUFBTSxJQUFBLG9CQUFTLEVBQUMsZUFBZSxDQUFDLENBQUM7WUFDckMsQ0FBQztZQUVELE1BQU0sSUFBQSxvQkFBUyxFQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDbEQsQ0FBQztRQUNELEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFtQjtZQUN0QyxNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNkLE9BQU87WUFDWCxDQUFDO1lBRUQsTUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDN0MsTUFBTSxJQUFBLG9CQUFTLEVBQUMsT0FBTyxDQUFDLENBQUM7WUFFekIsTUFBTSxVQUFVLEdBQUcsSUFBQSxXQUFJLEVBQUMsT0FBTyxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDbkQsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFBLHFCQUFVLEVBQUMsVUFBVSxDQUFDLENBQUM7WUFDbEQsSUFBSSxZQUFZLEVBQUUsQ0FBQztnQkFDZixPQUFPO1lBQ1gsQ0FBQztZQUVELE1BQU0sSUFBQSxvQkFBUyxFQUFDLFVBQVUsRUFBRSxhQUFhLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUUxRCxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUEscUJBQVUsRUFBQyxVQUFVLENBQUMsQ0FBQztZQUM3QyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ1gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pELE1BQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxZQUFZLEtBQUssQ0FBQyxDQUFDLDBCQUEwQixFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN0RixDQUFDO1lBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztZQUMvQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQyxDQUFDLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDMUUsQ0FBQztRQUNELEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxNQUFjLEVBQUUsTUFBYztZQUNwRCxNQUFNLGFBQWEsR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0MsTUFBTSxhQUFhLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRTNDLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxhQUFhLElBQUksYUFBYSxLQUFLLGFBQWEsRUFBRSxDQUFDO2dCQUN0RSxPQUFPO1lBQ1gsQ0FBQztZQUVELE1BQU0sT0FBTyxHQUFHLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ2hELE1BQU0sT0FBTyxHQUFHLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBRWhELE1BQU0sU0FBUyxHQUFHLE1BQU0sSUFBQSxxQkFBVSxFQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzVDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDYixNQUFNLElBQUksS0FBSyxDQUFDLFdBQVcsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUMxQyxDQUFDO1lBRUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxJQUFBLHFCQUFVLEVBQUMsT0FBTyxDQUFDLENBQUM7WUFDNUMsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDWixNQUFNLElBQUksS0FBSyxDQUFDLFlBQVksT0FBTyxFQUFFLENBQUMsQ0FBQztZQUMzQyxDQUFDO1lBRUQsTUFBTSxJQUFBLGVBQUksRUFBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDakMsQ0FBQztRQUNELEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxXQUFtQjtZQUN2QyxNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNkLE9BQU8sRUFBRSxDQUFDO1lBQ2QsQ0FBQztZQUVELE1BQU0sT0FBTyxHQUFHLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzdDLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxxQkFBVSxFQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3pDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDVixPQUFPLEVBQUUsQ0FBQztZQUNkLENBQUM7WUFFRCxNQUFNLFNBQVMsR0FBRyxDQUFDLE1BQU0sSUFBQSxrQkFBTyxFQUFDLE9BQU8sQ0FBQyxDQUFDO2lCQUNyQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksUUFBUSxLQUFLLGdCQUFnQixDQUFDO2lCQUNqRixJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBRS9ELE9BQU8sU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDaEMsUUFBUTtnQkFDUixJQUFJLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO2dCQUN0QyxRQUFRLEVBQUUsSUFBQSxXQUFJLEVBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQztnQkFDakMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDO2FBQy9DLENBQUMsQ0FBQyxDQUFDO1FBQ1IsQ0FBQztRQUNELEtBQUssQ0FBQyxjQUFjLENBQUMsUUFBZ0I7WUFDakMsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFBLG1CQUFRLEVBQUMsUUFBUSxDQUFDLENBQUM7WUFDekMsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNwRSxPQUFPLEVBQUUsQ0FBQztZQUNkLENBQUM7WUFFRCxPQUFPLE9BQXFCLENBQUM7UUFDakMsQ0FBQztRQUNELEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxPQUEwQjs7WUFDL0MsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzlCLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQSxNQUFBLEtBQUssQ0FBQyxjQUFjLDBDQUFFLFFBQVEsS0FBSSxFQUFFLENBQUM7WUFDOUQsTUFBTSxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFFckgsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQ3ZCLEtBQUssQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO29CQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUMxQixDQUFDO2dCQUNELE9BQU87WUFDWCxDQUFDO1lBRUQsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO2dCQUNuQixPQUFPO1lBQ1gsQ0FBQztZQUVELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5QixNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3BFLEtBQUssQ0FBQyxjQUFjLEdBQUc7Z0JBQ25CLFFBQVEsRUFBRSxVQUFVLENBQUMsUUFBUTtnQkFDN0IsT0FBTyxFQUFFLFNBQVMsQ0FBQyxZQUFZLENBQUM7YUFDbkMsQ0FBQztZQUNGLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDMUIsQ0FBQztRQUNELEtBQUssQ0FBQyxvQkFBb0I7WUFDdEIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLFdBQVcsQ0FBQztZQUNoRCxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUNkLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzdDLENBQUM7WUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN6RCxJQUFZLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQztZQUN2QyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMzQyxDQUFDO1FBQ0QsS0FBSyxDQUFDLGtCQUFrQixDQUFDLE9BQTBCOztZQUMvQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDOUIsTUFBTSxnQkFBZ0IsR0FBRyxDQUFBLE1BQUEsS0FBSyxDQUFDLGNBQWMsMENBQUUsUUFBUSxLQUFJLEVBQUUsQ0FBQztZQUU5RCxJQUFJLGFBQTBDLENBQUM7WUFDL0MsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO2dCQUNuQixhQUFhLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pGLENBQUM7WUFDRCxJQUFJLENBQUMsYUFBYSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDbkMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvQixDQUFDO1lBRUQsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUNqQixPQUFPLDBCQUEwQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzFDLENBQUM7WUFFRCxpRkFBaUY7WUFDakYsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUVyRixLQUFLLENBQUMsY0FBYyxHQUFHO2dCQUNuQixRQUFRLEVBQUUsYUFBYSxDQUFDLFFBQVE7Z0JBQ2hDLE9BQU8sRUFBRSxTQUFTLENBQUMsZUFBZSxDQUFDO2FBQ3RDLENBQUM7WUFDRixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRXRCLE9BQU8sZUFBZSxDQUFDO1FBQzNCLENBQUM7UUFDRCxLQUFLLENBQUMsdUJBQXVCO1lBQ3pCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMscUJBQWlELENBQUM7WUFDeEUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNWLE9BQU87WUFDWCxDQUFDO1lBRUQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzlCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDakQsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQ25GLE1BQU0sSUFBSSxHQUFnQixjQUFjLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1lBRTdELElBQVksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO1lBQ2xDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsSUFBSSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDaEYsQ0FBQztRQUVELG9DQUFvQztRQUNwQyxrQkFBa0I7WUFDZCxNQUFNLHVCQUF1QixHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsdUJBQTZDLENBQUM7WUFDckYsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLHNCQUE0QyxDQUFDO1lBQ25GLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxnQkFBMkMsQ0FBQztZQUM1RSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQXNDLENBQUM7WUFDbEUsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFxQyxDQUFDO1lBRS9ELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBNEIsQ0FBQztZQUNuRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQWtDLENBQUM7WUFDL0QsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxhQUFtQyxDQUFDO1lBQ2pFLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBNEIsQ0FBQztZQUNuRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQTRCLENBQUM7WUFDbkQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUE4QixDQUFDO1lBRXZELElBQUksdUJBQXVCO2dCQUFFLHVCQUF1QixDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQztZQUM3RixJQUFJLHNCQUFzQjtnQkFBRSxzQkFBc0IsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUM7WUFDMUYsSUFBSSxnQkFBZ0I7Z0JBQUUsZ0JBQWdCLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1lBQ3pGLElBQUksV0FBVztnQkFBRSxXQUFXLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBQzFFLElBQUksU0FBUztnQkFBRSxTQUFTLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTNELElBQUksTUFBTTtnQkFBRSxNQUFNLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQ3hELElBQUksWUFBWTtnQkFBRSxZQUFZLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1lBQzNFLElBQUksYUFBYTtnQkFBRSxhQUFhLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBQzlFLElBQUksTUFBTTtnQkFBRSxNQUFNLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQ3hELElBQUksTUFBTTtnQkFBRSxNQUFNLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQ3hELElBQUksUUFBUTtnQkFBRSxRQUFRLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRWxFLENBQUM7UUFFRCxvQkFBb0IsQ0FBQyxPQUEwQjs7WUFDM0MsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUE4QyxDQUFDO1lBQ3hFLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDYixPQUFPO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2xCLFNBQVMsQ0FBQyxTQUFTLEdBQUcseUNBQXlDLFVBQVUsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsWUFBWSxDQUFDO2dCQUN0RyxPQUFPO1lBQ1gsQ0FBQztZQUVELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQSxNQUFBLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxjQUFjLDBDQUFFLFFBQVEsS0FBSSxFQUFFLENBQUM7WUFDeEUsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUM5QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFFNUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxPQUFPO2lCQUN4QixHQUFHLENBQ0EsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUU7Z0JBQ2IsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFFBQVEsS0FBSyxnQkFBZ0IsQ0FBQztnQkFDdkQsTUFBTSxPQUFPLEdBQUcsa0JBQWtCLElBQUksVUFBVSxDQUFDO2dCQUVqRCxvQ0FBb0M7Z0JBQ3BDLElBQUksYUFBcUIsQ0FBQztnQkFDMUIsSUFBSSxZQUFZLElBQUksWUFBWSxDQUFDLFFBQVEsS0FBSyxLQUFLLElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztvQkFDdEYsYUFBYSxHQUFHLG9IQUFvSCxLQUFLLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLFdBQVcsQ0FBQztnQkFDak0sQ0FBQztxQkFBTSxDQUFDO29CQUNKLGFBQWEsR0FBRywyR0FBMkcsS0FBSyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsV0FBVyxDQUFDO2dCQUNoTCxDQUFDO2dCQUVELGtDQUFrQztnQkFDbEMsSUFBSSxXQUFtQixDQUFDO2dCQUN4QixJQUFJLFlBQVksSUFBSSxZQUFZLENBQUMsUUFBUSxLQUFLLEtBQUssSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLE1BQU0sRUFBRSxDQUFDO29CQUNwRixXQUFXLEdBQUcsa0hBQWtILEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxXQUFXLENBQUM7Z0JBQ3hOLENBQUM7cUJBQU0sQ0FBQztvQkFDSixXQUFXLEdBQUcsaUZBQWlGLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsV0FBVyxDQUFDO2dCQUMvSyxDQUFDO2dCQUVELE9BQU8sQ0FDUDtrQ0FDVSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQzsrQ0FDVCxVQUFVLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxrQkFBa0IsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQzt3SEFDMUQsS0FBSyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2tDQUN0TixXQUFXO2dIQUNtRSxLQUFLLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztrQ0FDakgsYUFBYTs4QkFDakIsQ0FDTCxDQUFDO1lBQ04sQ0FBQyxDQUNKO2lCQUNBLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsTUFBTTtZQUNGLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUM5QixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsZ0JBQTJDLENBQUM7WUFDNUUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFzQyxDQUFDO1lBRWxFLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztnQkFDbkIsZ0JBQWdCLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUM7WUFDL0MsQ0FBQztZQUNELElBQUksV0FBVyxFQUFFLENBQUM7Z0JBQ2QsV0FBVyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7WUFDM0IsQ0FBQztZQUNELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO1lBQ25ELEtBQUssSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7UUFDeEMsQ0FBQztRQUNELEtBQUssQ0FBQyx3QkFBd0I7WUFDMUIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzlCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUMxQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2YsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7Z0JBQy9ELE9BQU87WUFDWCxDQUFDO1lBRUQsTUFBTSxJQUFJLEdBQWtCLElBQVksQ0FBQyxZQUE0QixJQUFJLEtBQUssQ0FBQztZQUUvRSxJQUFJLENBQUM7Z0JBQ0QsSUFBSSxJQUFJLEtBQUssVUFBVSxFQUFFLENBQUM7b0JBQ3RCLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7b0JBQy9ELElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7b0JBQ2hGLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMscUJBQXFCLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUMvRixDQUFDO3FCQUFNLENBQUM7b0JBQ0osTUFBTSxJQUFJLENBQUMsd0JBQXdCLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQ2pELElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxjQUFjLEVBQUUsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN6RSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQyxDQUFDLGVBQWUsRUFBRSxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hGLENBQUM7Z0JBRUQsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBRXpDLE1BQU0sVUFBVSxHQUFHLElBQUEsV0FBSSxFQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLENBQUM7Z0JBQ3pFLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBQSxxQkFBVSxFQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNsRCxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7b0JBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxtQkFBbUIsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUN6RCxNQUFNLElBQUksS0FBSyxDQUFDLElBQUksWUFBWSxLQUFLLENBQUMsQ0FBQyxvQkFBb0IsRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2hGLENBQUM7Z0JBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQzVELE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMscUJBQXFCLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDdkUsS0FBSyxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RCLE1BQU0sSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7Z0JBQ3JDLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNsQixDQUFDO1lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDYixNQUFNLE1BQU0sR0FBRyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RFLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxtQkFBbUIsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUNyRCxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdEUsQ0FBQztRQUNMLENBQUM7UUFDRCxLQUFLLENBQUMsa0JBQWtCO1lBQ3BCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBc0MsQ0FBQztZQUNsRSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2YsT0FBTztZQUNYLENBQUM7WUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6RSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2YsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hFLE9BQU87WUFDWCxDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNoRSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ2QsT0FBTztZQUNYLENBQUM7WUFFRCxJQUFJLENBQUM7Z0JBQ0QsTUFBTSxJQUFJLENBQUMsd0JBQXdCLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ2pELE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUV6QyxNQUFNLGNBQWMsR0FBRyxHQUFHLFVBQVUsT0FBTyxDQUFDO2dCQUM1QyxNQUFNLGNBQWMsR0FBRyxJQUFBLFdBQUksRUFBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQztnQkFDM0UsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLHFCQUFVLEVBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ2hELElBQUksTUFBTSxFQUFFLENBQUM7b0JBQ1QsV0FBVyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7b0JBQ3ZCLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxrQkFBa0IsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO29CQUMzRCxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7b0JBQzFFLE9BQU87Z0JBQ1gsQ0FBQztnQkFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDMUQsTUFBTSxhQUFhLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTTtvQkFDakMsQ0FBQyxDQUFDLDBCQUEwQixDQUFDLFVBQVUsQ0FBQztvQkFDeEMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUU3QyxhQUFhLENBQUMsT0FBTyxHQUFHLGdCQUFnQixDQUFDO2dCQUN6QyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksSUFBSSxPQUFPLGFBQWEsQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ3JHLGFBQWEsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO2dCQUM1QixDQUFDO2dCQUNELGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQztnQkFDckMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQzlCLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHLHNCQUFzQixDQUFDO2dCQUN4RCxDQUFDO2dCQUVELE1BQU0sSUFBQSxvQkFBUyxFQUFDLGNBQWMsRUFBRSxhQUFhLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDOUQsTUFBTSxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztnQkFDckMsTUFBTSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztnQkFDbEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDN0QsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2IsTUFBTSxNQUFNLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN0RSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsc0JBQXNCLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDeEQsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3pFLENBQUM7WUFFRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDbEIsQ0FBQztRQUNELEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBYTtZQUMzQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM3QyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ1QsT0FBTztZQUNYLENBQUM7WUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzFELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUM5QixLQUFLLENBQUMsY0FBYyxHQUFHO2dCQUNuQixRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVE7Z0JBQ3hCLE9BQU8sRUFBRSxTQUFTLENBQUMsT0FBTyxDQUFDO2FBQzlCLENBQUM7WUFDRixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3RCLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN0RCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDbEIsQ0FBQztRQUVELG1DQUFtQztRQUNuQyxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQWE7WUFDM0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDeEMsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDYixPQUFPO1lBQ1gsQ0FBQztZQUVELE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFFLEVBQUUsQ0FBQyxVQUFVLEtBQUssS0FBSyxDQUFDLENBQUM7WUFDOUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztnQkFDMUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hELE9BQU87WUFDWCxDQUFDO1lBRUQsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNsRSxJQUFJLFlBQVksR0FBRyxDQUFDLENBQUM7WUFFckIsS0FBSyxNQUFNLFdBQVcsSUFBSSxhQUFhLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxDQUFDO29CQUNELE1BQU0sYUFBYSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQ3RFLE1BQU0sYUFBYSxHQUFHLHdCQUF3QixDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUMsQ0FBQztvQkFFM0UsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxLQUFLLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQzt3QkFDbEUsU0FBUztvQkFDYixDQUFDO29CQUVELE1BQU0sSUFBQSxvQkFBUyxFQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsYUFBYSxFQUFFLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQ3BFLFlBQVksSUFBSSxDQUFDLENBQUM7Z0JBQ3RCLENBQUM7Z0JBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztvQkFDYixNQUFNLE1BQU0sR0FBRyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3RFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQ3ZFLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMsaUJBQWlCLEVBQUUsV0FBVyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN6RixDQUFDO1lBQ0wsQ0FBQztZQUVELE1BQU0sSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFDckMsTUFBTSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUNsQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFFZCxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsa0JBQWtCLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMsbUJBQW1CLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZHLENBQUM7UUFDRCxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQWE7O1lBQzdCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzdDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDVCxPQUFPO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQztnQkFDRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxZQUFZLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNyRSxPQUFPO1lBQ1gsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2IsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3pFLENBQUM7WUFFRCxJQUFJLENBQUM7Z0JBQ0QsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNyQyxJQUFJLE1BQUEsUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFFLEtBQUssMENBQUUsUUFBUSxFQUFFLENBQUM7b0JBQzVCLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDeEMsT0FBTztnQkFDWCxDQUFDO1lBQ0wsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2IsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQywwQkFBMEIsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzVFLENBQUM7WUFFRCxJQUFJLE1BQUMsTUFBYyxDQUFDLEtBQUssMENBQUUsUUFBUSxFQUFFLENBQUM7Z0JBQ2pDLE1BQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDL0MsT0FBTztZQUNYLENBQUM7WUFFRCxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDekQsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUM1RSxDQUFDO1FBRUQscUNBQXFDO1FBQ3JDLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBYTtZQUM3QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM3QyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ1QsT0FBTztZQUNYLENBQUM7WUFFRCxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ3hCLE1BQU0sSUFBQSxpQkFBTSxFQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM3QixNQUFNLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ3JDLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDdEQsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2xCLENBQUM7UUFFRCwwQkFBMEI7UUFDMUIsVUFBVTtZQUNOLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMscUJBQWlELENBQUM7WUFDNUUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFxQyxDQUFDO1lBQzVELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBc0MsQ0FBQztZQUNsRSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQThDLENBQUM7WUFDM0UsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLGdCQUEyQyxDQUFDO1lBRTVFLFVBQVUsYUFBVixVQUFVLHVCQUFWLFVBQVUsQ0FBRSxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO2dCQUN2QyxLQUFLLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQ3pDLENBQUMsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7Z0JBQ25DLEtBQUssSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDbkMsQ0FBQyxDQUFDLENBQUM7WUFDSCxnQkFBZ0IsYUFBaEIsZ0JBQWdCLHVCQUFoQixnQkFBZ0IsQ0FBRSxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFO2dCQUM1QyxLQUFLLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ3hDLENBQUMsQ0FBQyxDQUFDO1lBQ0gsV0FBVyxhQUFYLFdBQVcsdUJBQVgsV0FBVyxDQUFFLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDLEtBQW9CLEVBQUUsRUFBRTtnQkFDOUQsSUFBSSxLQUFLLENBQUMsR0FBRyxLQUFLLE9BQU8sRUFBRSxDQUFDO29CQUN4QixLQUFLLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUNuQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7WUFFSCxZQUFZLGFBQVosWUFBWSx1QkFBWixZQUFZLENBQUUsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsS0FBWSxFQUFFLEVBQUU7Z0JBQ3JELE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUE0QixDQUFDO2dCQUNsRCxNQUFNLE1BQU0sR0FBRyxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsT0FBTyxDQUFDLGlDQUFpQyxDQUE2QixDQUFDO2dCQUM5RixJQUFJLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDN0IsT0FBTztnQkFDWCxDQUFDO2dCQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO2dCQUNyQyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDM0MsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3RCLE9BQU87Z0JBQ1gsQ0FBQztnQkFFRCx1Q0FBdUM7Z0JBQ3ZDLElBQUksTUFBTSxLQUFLLE1BQU0sRUFBRSxDQUFDO29CQUNwQixLQUFLLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQy9CLE9BQU87Z0JBQ1gsQ0FBQztnQkFDRCxJQUFJLE1BQU0sS0FBSyxjQUFjLEVBQUUsQ0FBQztvQkFDNUIsS0FBSyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUM3QixPQUFPO2dCQUNYLENBQUM7Z0JBRUQsb0NBQW9DO2dCQUVwQyx3REFBd0Q7Z0JBQ3hELElBQUksTUFBTSxLQUFLLGdCQUFnQixFQUFFLENBQUM7b0JBQzlCLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO29CQUN6QixLQUFLLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQy9CLE9BQU87Z0JBQ1gsQ0FBQztnQkFDRCxJQUFJLE1BQU0sS0FBSyxjQUFjLEVBQUUsQ0FBQztvQkFDNUIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7b0JBQ3pCLEtBQUssSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDN0IsT0FBTztnQkFDWCxDQUFDO2dCQUVELHFFQUFxRTtnQkFDckUsSUFBSSxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7b0JBQ3RCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUN0QyxPQUFPO2dCQUNYLENBQUM7Z0JBQ0QsSUFBSSxNQUFNLEtBQUssTUFBTSxFQUFFLENBQUM7b0JBQ3BCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUN4QyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7WUFFSCw2RUFBNkU7WUFDN0UsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUF5QixDQUFDO1lBQzdDLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxLQUFZLEVBQUUsRUFBRTtnQkFDNUMsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQTRCLENBQUM7Z0JBQ2xELHlEQUF5RDtnQkFDekQsTUFBTSxlQUFlLEdBQUcsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLE9BQU8sQ0FBQyw0R0FBNEcsQ0FBQyxDQUFDO2dCQUN0SixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7b0JBQ25CLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO29CQUN6QixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2xCLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7UUFDRCxLQUFLLENBQUMsZUFBZTtZQUNqQixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbEIsTUFBTSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDdkIsTUFBTSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUNsQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDbEIsQ0FBQztLQUNKO0lBQ0QsS0FBSztRQUNELEtBQUssSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFDRCxXQUFXLEtBQUksQ0FBQztJQUNoQixLQUFLLEtBQUksQ0FBQztDQUNiLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGVuc3VyZURpciwgbW92ZSwgcGF0aEV4aXN0cywgcmVhZEZpbGVTeW5jLCByZWFkSnNvbiwgcmVhZGRpciwgcmVtb3ZlLCB3cml0ZUpzb24gfSBmcm9tICdmcy1leHRyYSc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgcGFja2FnZUpTT04gZnJvbSAnLi4vLi4vLi4vcGFja2FnZS5qc29uJztcblxuY29uc3QgUEFDS0FHRV9OQU1FID0gcGFja2FnZUpTT04ubmFtZTtcbmNvbnN0IFBST0ZJTEVfS0VZID0gJ2kxOG5QYW5lbFN0YXRlJztcbmNvbnN0IFJFU09VUkNFU19EQl9ST09UID0gJ2RiOi8vYXNzZXRzL3Jlc291cmNlcyc7XG5jb25zdCBTQ0hFTUFfRklMRV9OQU1FID0gJy5zY2hlbWEuanNvbic7XG5jb25zdCBERUZBVUxUX0xPQ0FMRV9WRVJTSU9OID0gJzEuMC4wJztcbmNvbnN0IENPTkZJUk1fVElNRU9VVF9NUyA9IDMwMDA7XG5jb25zdCBUT0FTVF9EVVJBVElPTl9NUyA9IDUwMDA7XG5cbnR5cGUgVG9hc3RMZXZlbCA9ICdpbmZvJyB8ICdzdWNjZXNzJyB8ICd3YXJuJyB8ICdlcnJvcic7XG5cbmNvbnN0IExPQ0FMRV9TQ0hFTUEgPSB7XG4gICAgJHNjaGVtYTogJ2h0dHBzOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LzIwMjAtMTIvc2NoZW1hJyxcbiAgICAkaWQ6ICcuc2NoZW1hLmpzb24nLFxuICAgIHRpdGxlOiAnaTE4biBsb2NhbGUgZmlsZScsXG4gICAgdHlwZTogJ29iamVjdCcsXG4gICAgcmVxdWlyZWQ6IFsnbWV0YSddLFxuICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgbWV0YToge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICB0aXRsZTogJ+WkmuivreiogOaWh+acrE1ldGHkv6Hmga8nLFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnY29kZSddLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIGNvZGU6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAn5aSa6K+t6KiA57yW56CB77yI5Lmf5piv5aSa6K+t6KiA5paH5Lu25ZCN56ew77yM5Zu+54mH55uu5b2V5ZCN56ew77yJJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG5hbWU6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAn5aSa6K+t6KiA5ZCN56ewJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHZlcnNpb246IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAn5aSa6K+t6KiA54mI5pysJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG59O1xuXG50eXBlIEpzb25SZWNvcmQgPSBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuXG50eXBlIExvY2FsZVRlbXBsYXRlID0ge1xuICAgIGZpbGVOYW1lOiBzdHJpbmc7XG4gICAgY29udGVudDogSnNvblJlY29yZDtcbn07XG5cbnR5cGUgSTE4blBhbmVsU3RhdGUgPSB7XG4gICAgcmVzb3VyY2VEaXI6IHN0cmluZztcbiAgICB0ZW1wbGF0ZUxvY2FsZTogTG9jYWxlVGVtcGxhdGUgfCBudWxsO1xufTtcblxudHlwZSBMb2NhbGVGaWxlRW50cnkgPSB7XG4gICAgZmlsZU5hbWU6IHN0cmluZztcbiAgICBjb2RlOiBzdHJpbmc7XG4gICAgZnVsbFBhdGg6IHN0cmluZztcbiAgICBkYlBhdGg6IHN0cmluZztcbn07XG5cbnR5cGUgQ29uZmlybU1vZGUgPSAnYWRkJyB8ICd0cmFuc2Zlcic7XG5cbnR5cGUgQ29uZmlybUFjdGlvbiA9ICdkZWxldGUnIHwgJ3N5bmMnO1xuXG50eXBlIENvbmZpcm1TdGF0ZSA9IHtcbiAgICByb3dJbmRleDogbnVtYmVyO1xuICAgIGFjdGlvbjogQ29uZmlybUFjdGlvbjtcbiAgICB0aW1lcklkOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0Pjtcbn07XG5cbi8qKiBTaG9ydGhhbmQgZm9yIEVkaXRvci5JMThuLnQgd2l0aCB0aGUgZXh0ZW5zaW9uJ3MgcHJlZml4IGFuZCB7Tn0gaW50ZXJwb2xhdGlvbi4gKi9cbmZ1bmN0aW9uIHQoa2V5OiBzdHJpbmcsIC4uLmFyZ3M6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgICBjb25zdCBmdWxsS2V5ID0gYCR7UEFDS0FHRV9OQU1FfS4ke2tleX1gO1xuICAgIGxldCB0ZW1wbGF0ZTogc3RyaW5nO1xuICAgIHRyeSB7XG4gICAgICAgIHRlbXBsYXRlID0gKEVkaXRvci5JMThuLnQgYXMgYW55KShmdWxsS2V5KSBhcyBzdHJpbmc7XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHRlbXBsYXRlID0ga2V5O1xuICAgIH1cbiAgICAvLyBSZXBsYWNlIHswfSwgezF9LCAuLi4gd2l0aCB0aGUgcHJvdmlkZWQgYXJnc1xuICAgIGlmIChhcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmV0dXJuIHRlbXBsYXRlLnJlcGxhY2UoL1xceyhcXGQrKVxcfS9nLCAobWF0Y2gsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpID0gTnVtYmVyKGluZGV4KTtcbiAgICAgICAgICAgIHJldHVybiBpIDwgYXJncy5sZW5ndGggPyBhcmdzW2ldIDogbWF0Y2g7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcGxhdGU7XG59XG5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZTogYW55KTogdmFsdWUgaXMgSnNvblJlY29yZCB7XG4gICAgcmV0dXJuIEJvb2xlYW4odmFsdWUpICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkodmFsdWUpO1xufVxuXG5mdW5jdGlvbiBzeW5jTG9jYWxlTm9kZShiYXNlTm9kZTogSnNvblJlY29yZCwgdGFyZ2V0Tm9kZTogSnNvblJlY29yZCwgaXNSb290ID0gZmFsc2UpOiBKc29uUmVjb3JkIHtcbiAgICBjb25zdCBiYXNlID0gaXNKc29uT2JqZWN0KGJhc2VOb2RlKSA/IGJhc2VOb2RlIDoge307XG4gICAgY29uc3QgdGFyZ2V0ID0gaXNKc29uT2JqZWN0KHRhcmdldE5vZGUpID8gdGFyZ2V0Tm9kZSA6IHt9O1xuICAgIGNvbnN0IHJlc3VsdDogSnNvblJlY29yZCA9IHt9O1xuXG4gICAgT2JqZWN0LmtleXMoYmFzZSkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgIGlmIChpc1Jvb3QgJiYga2V5ID09PSAnbWV0YScpIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGFyZ2V0LCAnbWV0YScpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0Lm1ldGEgPSBjbG9uZUpzb24odGFyZ2V0Lm1ldGEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHQubWV0YSA9IGNsb25lSnNvbihiYXNlLm1ldGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYmFzZVZhbHVlID0gYmFzZVtrZXldO1xuICAgICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0YXJnZXQsIGtleSkpIHtcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gY2xvbmVKc29uKGJhc2VWYWx1ZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0YXJnZXRWYWx1ZSA9IHRhcmdldFtrZXldO1xuICAgICAgICBpZiAoaXNKc29uT2JqZWN0KGJhc2VWYWx1ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRUYXJnZXRWYWx1ZSA9IGlzSnNvbk9iamVjdCh0YXJnZXRWYWx1ZSkgPyB0YXJnZXRWYWx1ZSA6IHt9O1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBzeW5jTG9jYWxlTm9kZShiYXNlVmFsdWUsIG5vcm1hbGl6ZWRUYXJnZXRWYWx1ZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHRba2V5XSA9IGNsb25lSnNvbih0YXJnZXRWYWx1ZSk7XG4gICAgfSk7XG5cbiAgICBpZiAoaXNSb290ICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocmVzdWx0LCAnbWV0YScpICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0YXJnZXQsICdtZXRhJykpIHtcbiAgICAgICAgcmVzdWx0Lm1ldGEgPSBjbG9uZUpzb24odGFyZ2V0Lm1ldGEpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkU3luY2VkTG9jYWxlQ29udGVudChiYXNlQ29udGVudDogSnNvblJlY29yZCwgdGFyZ2V0Q29udGVudDogSnNvblJlY29yZCk6IEpzb25SZWNvcmQge1xuICAgIGNvbnN0IGJhc2VOb2RlID0gaXNKc29uT2JqZWN0KGJhc2VDb250ZW50KSA/IGJhc2VDb250ZW50IDoge307XG4gICAgY29uc3QgdGFyZ2V0Tm9kZSA9IGlzSnNvbk9iamVjdCh0YXJnZXRDb250ZW50KSA/IHRhcmdldENvbnRlbnQgOiB7fTtcblxuICAgIHJldHVybiBzeW5jTG9jYWxlTm9kZShiYXNlTm9kZSwgdGFyZ2V0Tm9kZSwgdHJ1ZSk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZURpcih2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdmFsdWUudHJpbSgpLnJlcGxhY2UoL15bXFxcXC9dK3xbXFxcXC9dKyQvZywgJycpO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVIdG1sKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB2YWx1ZVxuICAgICAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxuICAgICAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgICAgIC5yZXBsYWNlKC8+L2csICcmZ3Q7JylcbiAgICAgICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxuICAgICAgICAucmVwbGFjZSgvJy9nLCAnJiMzOTsnKTtcbn1cblxuZnVuY3Rpb24gY2xvbmVKc29uPFQ+KHZhbHVlOiBUKTogVCB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodmFsdWUpKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplTG9jYWxlQ29kZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gbm9ybWFsaXplRGlyKHZhbHVlKS5yZXBsYWNlKC9cXC5qc29uJC9pLCAnJyk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZURlZmF1bHRMb2NhbGVDb250ZW50KGNvZGU6IHN0cmluZyk6IEpzb25SZWNvcmQge1xuICAgIHJldHVybiB7XG4gICAgICAgICRzY2hlbWE6IFNDSEVNQV9GSUxFX05BTUUsXG4gICAgICAgIG1ldGE6IHtcbiAgICAgICAgICAgIGNvZGUsXG4gICAgICAgICAgICB2ZXJzaW9uOiBERUZBVUxUX0xPQ0FMRV9WRVJTSU9OLFxuICAgICAgICB9LFxuICAgIH07XG59XG5cbmZ1bmN0aW9uIGdldFJlc291cmNlc0ZzUm9vdCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBqb2luKEVkaXRvci5Qcm9qZWN0LnBhdGgsICdhc3NldHMnLCAncmVzb3VyY2VzJyk7XG59XG5cbmZ1bmN0aW9uIHRvUmVzb3VyY2VEYlBhdGgocmVsYXRpdmVEaXI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZURpcihyZWxhdGl2ZURpcik7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZWQgPyBgJHtSRVNPVVJDRVNfREJfUk9PVH0vJHtub3JtYWxpemVkfWAgOiBSRVNPVVJDRVNfREJfUk9PVDtcbn1cblxuZnVuY3Rpb24gdG9SZXNvdXJjZUZzUGF0aChyZWxhdGl2ZURpcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplRGlyKHJlbGF0aXZlRGlyKTtcbiAgICByZXR1cm4gbm9ybWFsaXplZCA/IGpvaW4oZ2V0UmVzb3VyY2VzRnNSb290KCksIG5vcm1hbGl6ZWQpIDogZ2V0UmVzb3VyY2VzRnNSb290KCk7XG59XG5cbmZ1bmN0aW9uIHRvTG9jYWxlRGJQYXRoKHJlc291cmNlRGlyOiBzdHJpbmcsIGZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHt0b1Jlc291cmNlRGJQYXRoKHJlc291cmNlRGlyKX0vJHtmaWxlTmFtZX1gO1xufVxuLyoqXG4gKiBAemgg5aaC5p6c5biM5pyb5YW85a65IDMuMyDkuYvliY3nmoTniYjmnKzlj6/ku6Xkvb/nlKjkuIvmlrnnmoTku6PnoIFcbiAqIEBlbiBZb3UgY2FuIGFkZCB0aGUgY29kZSBiZWxvdyBpZiB5b3Ugd2FudCBjb21wYXRpYmlsaXR5IHdpdGggdmVyc2lvbnMgcHJpb3IgdG8gMy4zXG4gKi9cbi8vIEVkaXRvci5QYW5lbC5kZWZpbmUgPSBFZGl0b3IuUGFuZWwuZGVmaW5lIHx8IGZ1bmN0aW9uKG9wdGlvbnM6IGFueSkgeyByZXR1cm4gb3B0aW9ucyB9XG5tb2R1bGUuZXhwb3J0cyA9IEVkaXRvci5QYW5lbC5kZWZpbmUoe1xuICAgIGxpc3RlbmVyczoge1xuICAgICAgICBzaG93KCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Nob3cnKTtcbiAgICAgICAgfSxcbiAgICAgICAgaGlkZSgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdoaWRlJyk7XG4gICAgICAgIH0sXG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3RlbXBsYXRlL2kxOG4vaW5kZXguaHRtbCcpLCAndXRmLTgnKSxcbiAgICBzdHlsZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3N0eWxlL2kxOG4vaW5kZXguY3NzJyksICd1dGYtOCcpLFxuICAgICQ6IHtcbiAgICAgICAgYXBwOiAnI2FwcCcsXG4gICAgICAgIHJlc291cmNlRGlySW5wdXQ6ICcjcmVzb3VyY2VEaXJJbnB1dCcsXG4gICAgICAgIGNvbmZpcm1SZXNvdXJjZURpckJ0bjogJyNjb25maXJtUmVzb3VyY2VEaXJCdG4nLFxuICAgICAgICBkaXJUYWJsZUJvZHk6ICcjZGlyVGFibGVCb2R5JyxcbiAgICAgICAgbmV3RGlySW5wdXQ6ICcjbmV3RGlySW5wdXQnLFxuICAgICAgICBhZGREaXJCdG46ICcjYWRkRGlyQnRuJyxcbiAgICAgICAgc2VjdGlvblJlc291cmNlRGlyVGl0bGU6ICcjc2VjdGlvblJlc291cmNlRGlyVGl0bGUnLFxuICAgICAgICBzZWN0aW9uTG9jYWxlTGlzdFRpdGxlOiAnI3NlY3Rpb25Mb2NhbGVMaXN0VGl0bGUnLFxuICAgICAgICB0aENvZGU6ICcjdGhDb2RlJyxcbiAgICAgICAgdGhJc1RlbXBsYXRlOiAnI3RoSXNUZW1wbGF0ZScsXG4gICAgICAgIHRoU2V0VGVtcGxhdGU6ICcjdGhTZXRUZW1wbGF0ZScsXG4gICAgICAgIHRoU3luYzogJyN0aFN5bmMnLFxuICAgICAgICB0aE9wZW46ICcjdGhPcGVuJyxcbiAgICAgICAgdGhEZWxldGU6ICcjdGhEZWxldGUnLFxuICAgICAgICB0b2FzdENvbnRhaW5lcjogJyN0b2FzdENvbnRhaW5lcicsXG4gICAgfSxcbiAgICBtZXRob2RzOiB7XG4gICAgICAgIC8vIC0tLS0gU3RhdGUgaGVscGVycyAtLS0tXG4gICAgICAgIGdldERlZmF1bHRTdGF0ZSgpOiBJMThuUGFuZWxTdGF0ZSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc291cmNlRGlyOiAnJyxcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZUxvY2FsZTogbnVsbCxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGdldFN0YXRlKCk6IEkxOG5QYW5lbFN0YXRlIHtcbiAgICAgICAgICAgIHJldHVybiAoKHRoaXMgYXMgYW55KS5fc3RhdGUgYXMgSTE4blBhbmVsU3RhdGUpIHx8IHRoaXMuZ2V0RGVmYXVsdFN0YXRlKCk7XG4gICAgICAgIH0sXG4gICAgICAgIGdldExvY2FsZUVudHJpZXMoKTogTG9jYWxlRmlsZUVudHJ5W10ge1xuICAgICAgICAgICAgcmV0dXJuICgodGhpcyBhcyBhbnkpLl9sb2NhbGVFbnRyaWVzIGFzIExvY2FsZUZpbGVFbnRyeVtdKSB8fCBbXTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyAtLS0tIENvbmZpcm0gc3RhdGUgaGVscGVycyAoZGVsYXllZCBkb3VibGUtY2xpY2sgcGF0dGVybikgLS0tLVxuICAgICAgICBnZXRDb25maXJtU3RhdGUoKTogQ29uZmlybVN0YXRlIHwgbnVsbCB7XG4gICAgICAgICAgICByZXR1cm4gKCh0aGlzIGFzIGFueSkuX2NvbmZpcm1TdGF0ZSBhcyBDb25maXJtU3RhdGUpIHx8IG51bGw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldENvbmZpcm1TdGF0ZShzdGF0ZTogQ29uZmlybVN0YXRlIHwgbnVsbCkge1xuICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5fY29uZmlybVN0YXRlID0gc3RhdGU7XG4gICAgICAgIH0sXG4gICAgICAgIGNsZWFyQ29uZmlybVN0YXRlKCkge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IHRoaXMuZ2V0Q29uZmlybVN0YXRlKCk7XG4gICAgICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChjdXJyZW50LnRpbWVySWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q29uZmlybVN0YXRlKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBhcm1Db25maXJtU3RhdGUocm93SW5kZXg6IG51bWJlciwgYWN0aW9uOiBDb25maXJtQWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyQ29uZmlybVN0YXRlKCk7XG4gICAgICAgICAgICBjb25zdCB0aW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRDb25maXJtU3RhdGUobnVsbCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICAgICAgICAgIH0sIENPTkZJUk1fVElNRU9VVF9NUyk7XG4gICAgICAgICAgICB0aGlzLnNldENvbmZpcm1TdGF0ZSh7IHJvd0luZGV4LCBhY3Rpb24sIHRpbWVySWQgfSk7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIC0tLS0gVG9hc3Qgbm90aWZpY2F0aW9ucyAoYXV0by1kaXNtaXNzIGFmdGVyIDVzKSAtLS0tXG4gICAgICAgIGFkZExvZyhsZXZlbDogVG9hc3RMZXZlbCwgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLiQudG9hc3RDb250YWluZXIgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgaWYgKCFjb250YWluZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB0b2FzdC5jbGFzc05hbWUgPSBgdG9hc3QtaXRlbSB0b2FzdC0ke2xldmVsfWA7XG4gICAgICAgICAgICB0b2FzdC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQodG9hc3QpO1xuXG4gICAgICAgICAgICAvLyBSZW1vdmUgZnJvbSBET00gYWZ0ZXIgYW5pbWF0aW9uIGZpbmlzaGVzICh0b2FzdC1vdXQgc3RhcnRzIGF0IDQuNXMsIGxhc3RzIDAuM3MpXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodG9hc3QucGFyZW50Tm9kZSkge1xuICAgICAgICAgICAgICAgICAgICB0b2FzdC5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBUT0FTVF9EVVJBVElPTl9NUyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gLS0tLSBUZW1wbGF0ZSBsb2NhbGUgbm9ybWFsaXphdGlvbiAtLS0tXG4gICAgICAgIG5vcm1hbGl6ZVRlbXBsYXRlTG9jYWxlKHRlbXBsYXRlTG9jYWxlOiBMb2NhbGVUZW1wbGF0ZSB8IG51bGwgfCB1bmRlZmluZWQpOiBMb2NhbGVUZW1wbGF0ZSB8IG51bGwge1xuICAgICAgICAgICAgaWYgKCF0ZW1wbGF0ZUxvY2FsZSB8fCB0eXBlb2YgdGVtcGxhdGVMb2NhbGUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGZpbGVOYW1lID0gU3RyaW5nKHRlbXBsYXRlTG9jYWxlLmZpbGVOYW1lIHx8ICcnKS50cmltKCk7XG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gdGVtcGxhdGVMb2NhbGUuY29udGVudDtcbiAgICAgICAgICAgIGlmICghZmlsZU5hbWUgfHwgIWNvbnRlbnQgfHwgdHlwZW9mIGNvbnRlbnQgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBmaWxlTmFtZSxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBjbG9uZUpzb24oY29udGVudCksXG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBub3JtYWxpemVTdGF0ZShzdGF0ZTogUGFydGlhbDxJMThuUGFuZWxTdGF0ZT4gfCBudWxsIHwgdW5kZWZpbmVkKTogSTE4blBhbmVsU3RhdGUge1xuICAgICAgICAgICAgY29uc3QgZGVmYXVsdFN0YXRlID0gdGhpcy5nZXREZWZhdWx0U3RhdGUoKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlRGlyID0gbm9ybWFsaXplRGlyKHN0YXRlPy5yZXNvdXJjZURpciB8fCBkZWZhdWx0U3RhdGUucmVzb3VyY2VEaXIpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlc291cmNlRGlyLFxuICAgICAgICAgICAgICAgIHRlbXBsYXRlTG9jYWxlOiB0aGlzLm5vcm1hbGl6ZVRlbXBsYXRlTG9jYWxlKHN0YXRlPy50ZW1wbGF0ZUxvY2FsZSksXG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyBsb2FkU3RhdGUoKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgRWRpdG9yLlByb2ZpbGUuZ2V0UHJvamVjdChQQUNLQUdFX05BTUUsIFBST0ZJTEVfS0VZKTtcbiAgICAgICAgICAgICAgICAodGhpcyBhcyBhbnkpLl9zdGF0ZSA9IHRoaXMubm9ybWFsaXplU3RhdGUoc3RhdGUgYXMgUGFydGlhbDxJMThuUGFuZWxTdGF0ZT4pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFske1BBQ0tBR0VfTkFNRX1dYCwgdCgnbG9nX3Byb2ZpbGVfbG9hZF9mYWlsZWQnKSwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICh0aGlzIGFzIGFueSkuX3N0YXRlID0gdGhpcy5nZXREZWZhdWx0U3RhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc2F2ZVN0YXRlKHN0YXRlOiBJMThuUGFuZWxTdGF0ZSkge1xuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZFN0YXRlID0gdGhpcy5ub3JtYWxpemVTdGF0ZShzdGF0ZSk7XG4gICAgICAgICAgICAodGhpcyBhcyBhbnkpLl9zdGF0ZSA9IG5vcm1hbGl6ZWRTdGF0ZTtcblxuICAgICAgICAgICAgdm9pZCBFZGl0b3IuUHJvZmlsZS5zZXRQcm9qZWN0KFBBQ0tBR0VfTkFNRSwgUFJPRklMRV9LRVksIG5vcm1hbGl6ZWRTdGF0ZSwgJ3Byb2plY3QnKS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFske1BBQ0tBR0VfTkFNRX1dYCwgdCgnbG9nX3Byb2ZpbGVfc2F2ZV9mYWlsZWQnKSwgZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGdldFJlc291cmNlRGlyKCk6IHN0cmluZyB7XG4gICAgICAgICAgICBjb25zdCBpbnB1dCA9IHRoaXMuJC5yZXNvdXJjZURpcklucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgcmV0dXJuIG5vcm1hbGl6ZURpcihpbnB1dD8udmFsdWUgfHwgJycpO1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyBleGlzdHNJblJlc291cmNlc0RiKHJlbGF0aXZlRGlyOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIocmVsYXRpdmVEaXIpO1xuICAgICAgICAgICAgaWYgKCFub3JtYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdG9SZXNvdXJjZURiUGF0aChub3JtYWxpemVkKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEJvb2xlYW4oaW5mbyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfYXNzZXRfZGJfcXVlcnlfZmFpbGVkJyksIGVycm9yKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGF0aEV4aXN0cyh0b1Jlc291cmNlRnNQYXRoKG5vcm1hbGl6ZWQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgcmVmcmVzaFJlc291cmNlc0Fzc2V0RGIoKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnLCBSRVNPVVJDRVNfREJfUk9PVCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfYXNzZXRfZGJfcmVmcmVzaF9mYWlsZWQnKSwgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBhc3luYyBlbnN1cmVSZXNvdXJjZURpckNyZWF0ZWQocmVsYXRpdmVEaXI6IHN0cmluZykge1xuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZURpcihyZWxhdGl2ZURpcik7XG4gICAgICAgICAgICBpZiAoIW5vcm1hbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlc0ZzUm9vdCA9IGdldFJlc291cmNlc0ZzUm9vdCgpO1xuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VzRXhpc3RzID0gYXdhaXQgcGF0aEV4aXN0cyhyZXNvdXJjZXNGc1Jvb3QpO1xuICAgICAgICAgICAgaWYgKCFyZXNvdXJjZXNFeGlzdHMpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBlbnN1cmVEaXIocmVzb3VyY2VzRnNSb290KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgZW5zdXJlRGlyKHRvUmVzb3VyY2VGc1BhdGgobm9ybWFsaXplZCkpO1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyBlbnN1cmVTY2hlbWFGaWxlKHJlbGF0aXZlRGlyOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIocmVsYXRpdmVEaXIpO1xuICAgICAgICAgICAgaWYgKCFub3JtYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBkaXJQYXRoID0gdG9SZXNvdXJjZUZzUGF0aChub3JtYWxpemVkKTtcbiAgICAgICAgICAgIGF3YWl0IGVuc3VyZURpcihkaXJQYXRoKTtcblxuICAgICAgICAgICAgY29uc3Qgc2NoZW1hUGF0aCA9IGpvaW4oZGlyUGF0aCwgU0NIRU1BX0ZJTEVfTkFNRSk7XG4gICAgICAgICAgICBjb25zdCBzY2hlbWFFeGlzdHMgPSBhd2FpdCBwYXRoRXhpc3RzKHNjaGVtYVBhdGgpO1xuICAgICAgICAgICAgaWYgKHNjaGVtYUV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgd3JpdGVKc29uKHNjaGVtYVBhdGgsIExPQ0FMRV9TQ0hFTUEsIHsgc3BhY2VzOiAyIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcGF0aEV4aXN0cyhzY2hlbWFQYXRoKTtcbiAgICAgICAgICAgIGlmICghY3JlYXRlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTG9nKCdlcnJvcicsIHQoJ29wX3NjaGVtYV9taXNzaW5nJywgc2NoZW1hUGF0aCkpO1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgWyR7UEFDS0FHRV9OQU1FfV0gJHt0KCdsb2dfc2NoZW1hX2NyZWF0ZV9mYWlsZWQnLCBzY2hlbWFQYXRoKX1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5hZGRMb2coJ3N1Y2Nlc3MnLCB0KCdvcF9zY2hlbWFfY3JlYXRlZCcpKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtQQUNLQUdFX05BTUV9XWAsIHQoJ2xvZ19zY2hlbWFfY3JlYXRlZCcsIHNjaGVtYVBhdGgpKTtcbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgdHJhbnNmZXJSZXNvdXJjZURpcihvbGREaXI6IHN0cmluZywgbmV3RGlyOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IG9sZE5vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIob2xkRGlyKTtcbiAgICAgICAgICAgIGNvbnN0IG5ld05vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIobmV3RGlyKTtcblxuICAgICAgICAgICAgaWYgKCFvbGROb3JtYWxpemVkIHx8ICFuZXdOb3JtYWxpemVkIHx8IG9sZE5vcm1hbGl6ZWQgPT09IG5ld05vcm1hbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG9sZFBhdGggPSB0b1Jlc291cmNlRnNQYXRoKG9sZE5vcm1hbGl6ZWQpO1xuICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHRvUmVzb3VyY2VGc1BhdGgobmV3Tm9ybWFsaXplZCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG9sZEV4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMob2xkUGF0aCk7XG4gICAgICAgICAgICBpZiAoIW9sZEV4aXN0cykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihg5Y6f55uu5b2V5LiN5a2Y5ZyoOiAke29sZFBhdGh9YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5ld0V4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMobmV3UGF0aCk7XG4gICAgICAgICAgICBpZiAobmV3RXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDnm67moIfnm67lvZXlt7LlrZjlnKg6ICR7bmV3UGF0aH1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgbW92ZShvbGRQYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgbGlzdExvY2FsZUVudHJpZXMocmVsYXRpdmVEaXI6IHN0cmluZyk6IFByb21pc2U8TG9jYWxlRmlsZUVudHJ5W10+IHtcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIocmVsYXRpdmVEaXIpO1xuICAgICAgICAgICAgaWYgKCFub3JtYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBkaXJQYXRoID0gdG9SZXNvdXJjZUZzUGF0aChub3JtYWxpemVkKTtcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMoZGlyUGF0aCk7XG4gICAgICAgICAgICBpZiAoIWV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZmlsZU5hbWVzID0gKGF3YWl0IHJlYWRkaXIoZGlyUGF0aCkpXG4gICAgICAgICAgICAgICAgLmZpbHRlcigoZmlsZU5hbWUpID0+IGZpbGVOYW1lLmVuZHNXaXRoKCcuanNvbicpICYmIGZpbGVOYW1lICE9PSBTQ0hFTUFfRklMRV9OQU1FKVxuICAgICAgICAgICAgICAgIC5zb3J0KChsZWZ0LCByaWdodCkgPT4gbGVmdC5sb2NhbGVDb21wYXJlKHJpZ2h0LCAnemgtQ04nKSk7XG5cbiAgICAgICAgICAgIHJldHVybiBmaWxlTmFtZXMubWFwKChmaWxlTmFtZSkgPT4gKHtcbiAgICAgICAgICAgICAgICBmaWxlTmFtZSxcbiAgICAgICAgICAgICAgICBjb2RlOiBmaWxlTmFtZS5yZXBsYWNlKC9cXC5qc29uJC9pLCAnJyksXG4gICAgICAgICAgICAgICAgZnVsbFBhdGg6IGpvaW4oZGlyUGF0aCwgZmlsZU5hbWUpLFxuICAgICAgICAgICAgICAgIGRiUGF0aDogdG9Mb2NhbGVEYlBhdGgobm9ybWFsaXplZCwgZmlsZU5hbWUpLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyByZWFkTG9jYWxlSnNvbihmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxKc29uUmVjb3JkPiB7XG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgcmVhZEpzb24oZmlsZVBhdGgpO1xuICAgICAgICAgICAgaWYgKCFjb250ZW50IHx8IHR5cGVvZiBjb250ZW50ICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KGNvbnRlbnQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29udGVudCBhcyBKc29uUmVjb3JkO1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyBzeW5jVGVtcGxhdGVMb2NhbGUoZW50cmllczogTG9jYWxlRmlsZUVudHJ5W10pIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGVGaWxlTmFtZSA9IHN0YXRlLnRlbXBsYXRlTG9jYWxlPy5maWxlTmFtZSB8fCAnJztcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nVGVtcGxhdGUgPSB0ZW1wbGF0ZUZpbGVOYW1lID8gZW50cmllcy5maW5kKChlbnRyeSkgPT4gZW50cnkuZmlsZU5hbWUgPT09IHRlbXBsYXRlRmlsZU5hbWUpIDogdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICBpZiAoIWVudHJpZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXRlLnRlbXBsYXRlTG9jYWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlLnRlbXBsYXRlTG9jYWxlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlU3RhdGUoc3RhdGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChleGlzdGluZ1RlbXBsYXRlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBmaXJzdEVudHJ5ID0gZW50cmllc1swXTtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0Q29udGVudCA9IGF3YWl0IHRoaXMucmVhZExvY2FsZUpzb24oZmlyc3RFbnRyeS5mdWxsUGF0aCk7XG4gICAgICAgICAgICBzdGF0ZS50ZW1wbGF0ZUxvY2FsZSA9IHtcbiAgICAgICAgICAgICAgICBmaWxlTmFtZTogZmlyc3RFbnRyeS5maWxlTmFtZSxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBjbG9uZUpzb24oZmlyc3RDb250ZW50KSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLnNhdmVTdGF0ZShzdGF0ZSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFzeW5jIHJlZnJlc2hMb2NhbGVFbnRyaWVzKCkge1xuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VEaXIgPSB0aGlzLmdldFN0YXRlKCkucmVzb3VyY2VEaXI7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2VEaXIpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZVNjaGVtYUZpbGUocmVzb3VyY2VEaXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBlbnRyaWVzID0gYXdhaXQgdGhpcy5saXN0TG9jYWxlRW50cmllcyhyZXNvdXJjZURpcik7XG4gICAgICAgICAgICAodGhpcyBhcyBhbnkpLl9sb2NhbGVFbnRyaWVzID0gZW50cmllcztcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc3luY1RlbXBsYXRlTG9jYWxlKGVudHJpZXMpO1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyBnZXRUZW1wbGF0ZUNvbnRlbnQoZW50cmllczogTG9jYWxlRmlsZUVudHJ5W10pOiBQcm9taXNlPEpzb25SZWNvcmQ+IHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGVGaWxlTmFtZSA9IHN0YXRlLnRlbXBsYXRlTG9jYWxlPy5maWxlTmFtZSB8fCAnJztcblxuICAgICAgICAgICAgbGV0IHRlbXBsYXRlRW50cnk6IExvY2FsZUZpbGVFbnRyeSB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmICh0ZW1wbGF0ZUZpbGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgdGVtcGxhdGVFbnRyeSA9IGVudHJpZXMuZmluZCgoZW50cnkpID0+IGVudHJ5LmZpbGVOYW1lID09PSB0ZW1wbGF0ZUZpbGVOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGVtcGxhdGVFbnRyeSAmJiBlbnRyaWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRlbXBsYXRlRW50cnkgPSBlbnRyaWVzWzBdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXRlbXBsYXRlRW50cnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3JlYXRlRGVmYXVsdExvY2FsZUNvbnRlbnQoJycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBbHdheXMgcmVhZCBmcm9tIHRoZSB0ZW1wbGF0ZSBsb2NhbGUgZmlsZSB0byBhdm9pZCB1c2luZyBzdGFsZSBjYWNoZWQgY29udGVudC5cbiAgICAgICAgICAgIGNvbnN0IHRlbXBsYXRlQ29udGVudCA9IGNsb25lSnNvbihhd2FpdCB0aGlzLnJlYWRMb2NhbGVKc29uKHRlbXBsYXRlRW50cnkuZnVsbFBhdGgpKTtcblxuICAgICAgICAgICAgc3RhdGUudGVtcGxhdGVMb2NhbGUgPSB7XG4gICAgICAgICAgICAgICAgZmlsZU5hbWU6IHRlbXBsYXRlRW50cnkuZmlsZU5hbWUsXG4gICAgICAgICAgICAgICAgY29udGVudDogY2xvbmVKc29uKHRlbXBsYXRlQ29udGVudCksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5zYXZlU3RhdGUoc3RhdGUpO1xuXG4gICAgICAgICAgICByZXR1cm4gdGVtcGxhdGVDb250ZW50O1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyB1cGRhdGVDb25maXJtQnV0dG9uTW9kZSgpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1dHRvbiA9IHRoaXMuJC5jb25maXJtUmVzb3VyY2VEaXJCdG4gYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgaWYgKCFidXR0b24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xuICAgICAgICAgICAgY29uc3Qgc2F2ZWREaXIgPSBub3JtYWxpemVEaXIoc3RhdGUucmVzb3VyY2VEaXIpO1xuICAgICAgICAgICAgY29uc3Qgc2F2ZWREaXJFeGlzdHMgPSBzYXZlZERpciA/IGF3YWl0IHRoaXMuZXhpc3RzSW5SZXNvdXJjZXNEYihzYXZlZERpcikgOiBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IG1vZGU6IENvbmZpcm1Nb2RlID0gc2F2ZWREaXJFeGlzdHMgPyAndHJhbnNmZXInIDogJ2FkZCc7XG5cbiAgICAgICAgICAgICh0aGlzIGFzIGFueSkuX2NvbmZpcm1Nb2RlID0gbW9kZTtcbiAgICAgICAgICAgIGJ1dHRvbi50ZXh0Q29udGVudCA9IG1vZGUgPT09ICd0cmFuc2ZlcicgPyB0KCdidG5fdHJhbnNmZXInKSA6IHQoJ2J0bl9hZGQnKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyAtLS0tIExvY2FsaXplIHN0YXRpYyBVSSB0ZXh0IC0tLS1cbiAgICAgICAgbG9jYWxpemVTdGF0aWNUZXh0KCkge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvblJlc291cmNlRGlyVGl0bGUgPSB0aGlzLiQuc2VjdGlvblJlc291cmNlRGlyVGl0bGUgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkxvY2FsZUxpc3RUaXRsZSA9IHRoaXMuJC5zZWN0aW9uTG9jYWxlTGlzdFRpdGxlIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlRGlySW5wdXQgPSB0aGlzLiQucmVzb3VyY2VEaXJJbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IG5ld0RpcklucHV0ID0gdGhpcy4kLm5ld0RpcklucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgY29uc3QgYWRkRGlyQnRuID0gdGhpcy4kLmFkZERpckJ0biBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cbiAgICAgICAgICAgIGNvbnN0IHRoQ29kZSA9IHRoaXMuJC50aENvZGUgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgY29uc3QgdGhJc1RlbXBsYXRlID0gdGhpcy4kLnRoSXNUZW1wbGF0ZSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICAgICAgICBjb25zdCB0aFNldFRlbXBsYXRlID0gdGhpcy4kLnRoU2V0VGVtcGxhdGUgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgY29uc3QgdGhTeW5jID0gdGhpcy4kLnRoU3luYyBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICAgICAgICBjb25zdCB0aE9wZW4gPSB0aGlzLiQudGhPcGVuIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHRoRGVsZXRlID0gdGhpcy4kLnRoRGVsZXRlIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblxuICAgICAgICAgICAgaWYgKHNlY3Rpb25SZXNvdXJjZURpclRpdGxlKSBzZWN0aW9uUmVzb3VyY2VEaXJUaXRsZS50ZXh0Q29udGVudCA9IHQoJ3NlY3Rpb25fcmVzb3VyY2VfZGlyJyk7XG4gICAgICAgICAgICBpZiAoc2VjdGlvbkxvY2FsZUxpc3RUaXRsZSkgc2VjdGlvbkxvY2FsZUxpc3RUaXRsZS50ZXh0Q29udGVudCA9IHQoJ3NlY3Rpb25fbG9jYWxlX2xpc3QnKTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZURpcklucHV0KSByZXNvdXJjZURpcklucHV0LnBsYWNlaG9sZGVyID0gdCgnaW5wdXRfcmVzb3VyY2VfZGlyX3BsYWNlaG9sZGVyJyk7XG4gICAgICAgICAgICBpZiAobmV3RGlySW5wdXQpIG5ld0RpcklucHV0LnBsYWNlaG9sZGVyID0gdCgnaW5wdXRfbmV3X2Rpcl9wbGFjZWhvbGRlcicpO1xuICAgICAgICAgICAgaWYgKGFkZERpckJ0bikgYWRkRGlyQnRuLnRleHRDb250ZW50ID0gdCgnYnRuX2FkZF9sb2NhbGUnKTtcblxuICAgICAgICAgICAgaWYgKHRoQ29kZSkgdGhDb2RlLnRleHRDb250ZW50ID0gdCgndGFibGVfaGVhZGVyX2NvZGUnKTtcbiAgICAgICAgICAgIGlmICh0aElzVGVtcGxhdGUpIHRoSXNUZW1wbGF0ZS50ZXh0Q29udGVudCA9IHQoJ3RhYmxlX2hlYWRlcl9pc190ZW1wbGF0ZScpO1xuICAgICAgICAgICAgaWYgKHRoU2V0VGVtcGxhdGUpIHRoU2V0VGVtcGxhdGUudGV4dENvbnRlbnQgPSB0KCd0YWJsZV9oZWFkZXJfc2V0X3RlbXBsYXRlJyk7XG4gICAgICAgICAgICBpZiAodGhTeW5jKSB0aFN5bmMudGV4dENvbnRlbnQgPSB0KCd0YWJsZV9oZWFkZXJfc3luYycpO1xuICAgICAgICAgICAgaWYgKHRoT3BlbikgdGhPcGVuLnRleHRDb250ZW50ID0gdCgndGFibGVfaGVhZGVyX29wZW4nKTtcbiAgICAgICAgICAgIGlmICh0aERlbGV0ZSkgdGhEZWxldGUudGV4dENvbnRlbnQgPSB0KCd0YWJsZV9oZWFkZXJfZGVsZXRlJyk7XG5cbiAgICAgICAgfSxcblxuICAgICAgICByZW5kZXJEaXJlY3RvcnlUYWJsZShlbnRyaWVzOiBMb2NhbGVGaWxlRW50cnlbXSkge1xuICAgICAgICAgICAgY29uc3QgdGFibGVCb2R5ID0gdGhpcy4kLmRpclRhYmxlQm9keSBhcyBIVE1MVGFibGVTZWN0aW9uRWxlbWVudCB8IG51bGw7XG4gICAgICAgICAgICBpZiAoIXRhYmxlQm9keSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFlbnRyaWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRhYmxlQm9keS5pbm5lckhUTUwgPSBgPHRyPjx0ZCBjb2xzcGFuPVwiNlwiIGNsYXNzPVwiZW1wdHktdGlwXCI+JHtlc2NhcGVIdG1sKHQoJ2VtcHR5X3RpcCcpKX08L3RkPjwvdHI+YDtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHRlbXBsYXRlRmlsZU5hbWUgPSB0aGlzLmdldFN0YXRlKCkudGVtcGxhdGVMb2NhbGU/LmZpbGVOYW1lIHx8ICcnO1xuICAgICAgICAgICAgY29uc3QgaGFzTXVsdGlwbGVFbnRyaWVzID0gZW50cmllcy5sZW5ndGggPiAxO1xuICAgICAgICAgICAgY29uc3QgY29uZmlybVN0YXRlID0gdGhpcy5nZXRDb25maXJtU3RhdGUoKTtcblxuICAgICAgICAgICAgdGFibGVCb2R5LmlubmVySFRNTCA9IGVudHJpZXNcbiAgICAgICAgICAgICAgICAubWFwKFxuICAgICAgICAgICAgICAgICAgICAoZW50cnksIGluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1RlbXBsYXRlID0gZW50cnkuZmlsZU5hbWUgPT09IHRlbXBsYXRlRmlsZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjYW5TeW5jID0gaGFzTXVsdGlwbGVFbnRyaWVzICYmIGlzVGVtcGxhdGU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBkZWxldGUgYnV0dG9uIHJlbmRlcmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGRlbGV0ZUJ0bkh0bWw6IHN0cmluZztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25maXJtU3RhdGUgJiYgY29uZmlybVN0YXRlLnJvd0luZGV4ID09PSBpbmRleCAmJiBjb25maXJtU3RhdGUuYWN0aW9uID09PSAnZGVsZXRlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZUJ0bkh0bWwgPSBgPGJ1dHRvbiBjbGFzcz1cInRhYmxlLWFjdGlvbi1idG4gdGFibGUtYWN0aW9uLWJ0bi1jb25maXJtXCIgdHlwZT1cImJ1dHRvblwiIGRhdGEtYWN0aW9uPVwiY29uZmlybS1kZWxldGVcIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIj4ke2VzY2FwZUh0bWwodCgnYnRuX2NvbmZpcm1fZGVsZXRlJykpfTwvYnV0dG9uPmA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZUJ0bkh0bWwgPSBgPGJ1dHRvbiBjbGFzcz1cInRhYmxlLWFjdGlvbi1idG4gdGFibGUtYWN0aW9uLWJ0bi1kYW5nZXJcIiB0eXBlPVwiYnV0dG9uXCIgZGF0YS1hY3Rpb249XCJkZWxldGVcIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIj4ke2VzY2FwZUh0bWwodCgnYnRuX2RlbGV0ZScpKX08L2J1dHRvbj5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgc3luYyBidXR0b24gcmVuZGVyaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgc3luY0J0bkh0bWw6IHN0cmluZztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25maXJtU3RhdGUgJiYgY29uZmlybVN0YXRlLnJvd0luZGV4ID09PSBpbmRleCAmJiBjb25maXJtU3RhdGUuYWN0aW9uID09PSAnc3luYycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzeW5jQnRuSHRtbCA9IGA8YnV0dG9uIGNsYXNzPVwidGFibGUtYWN0aW9uLWJ0biB0YWJsZS1hY3Rpb24tYnRuLWNvbmZpcm1cIiB0eXBlPVwiYnV0dG9uXCIgZGF0YS1hY3Rpb249XCJjb25maXJtLXN5bmNcIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIiAke2NhblN5bmMgPyAnJyA6ICdkaXNhYmxlZCd9PiR7ZXNjYXBlSHRtbCh0KCdidG5fY29uZmlybV9zeW5jJykpfTwvYnV0dG9uPmA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN5bmNCdG5IdG1sID0gYDxidXR0b24gY2xhc3M9XCJ0YWJsZS1hY3Rpb24tYnRuXCIgdHlwZT1cImJ1dHRvblwiIGRhdGEtYWN0aW9uPVwic3luY1wiIGRhdGEtaW5kZXg9XCIke2luZGV4fVwiICR7Y2FuU3luYyA/ICcnIDogJ2Rpc2FibGVkJ30+JHtlc2NhcGVIdG1sKHQoJ2J0bl9zeW5jJykpfTwvYnV0dG9uPmA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICBgPHRyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD4ke2VzY2FwZUh0bWwoZW50cnkuY29kZSl9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PHNwYW4gY2xhc3M9XCIke2lzVGVtcGxhdGUgPyAndGVtcGxhdGUtZmxhZy15ZXMnIDogJ3RlbXBsYXRlLWZsYWctbm8nfVwiPiR7aXNUZW1wbGF0ZSA/IGVzY2FwZUh0bWwodCgndGVtcGxhdGVfeWVzJykpIDogZXNjYXBlSHRtbCh0KCd0ZW1wbGF0ZV9ubycpKX08L3NwYW4+PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PGJ1dHRvbiBjbGFzcz1cInRhYmxlLWFjdGlvbi1idG5cIiB0eXBlPVwiYnV0dG9uXCIgZGF0YS1hY3Rpb249XCJzZXQtdGVtcGxhdGVcIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIiAke2lzVGVtcGxhdGUgPyAnZGlzYWJsZWQnIDogJyd9PiR7aXNUZW1wbGF0ZSA/IGVzY2FwZUh0bWwodCgnYnRuX2N1cnJlbnRfdGVtcGxhdGUnKSkgOiBlc2NhcGVIdG1sKHQoJ2J0bl9zZXRfdGVtcGxhdGUnKSl9PC9idXR0b24+PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+JHtzeW5jQnRuSHRtbH08L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48YnV0dG9uIGNsYXNzPVwidGFibGUtYWN0aW9uLWJ0blwiIHR5cGU9XCJidXR0b25cIiBkYXRhLWFjdGlvbj1cIm9wZW5cIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIj4ke2VzY2FwZUh0bWwodCgnYnRuX29wZW4nKSl9PC9idXR0b24+PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+JHtkZWxldGVCdG5IdG1sfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RyPmBcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIC5qb2luKCcnKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVuZGVyKCkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZURpcklucHV0ID0gdGhpcy4kLnJlc291cmNlRGlySW5wdXQgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gICAgICAgICAgICBjb25zdCBuZXdEaXJJbnB1dCA9IHRoaXMuJC5uZXdEaXJJbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcblxuICAgICAgICAgICAgaWYgKHJlc291cmNlRGlySW5wdXQpIHtcbiAgICAgICAgICAgICAgICByZXNvdXJjZURpcklucHV0LnZhbHVlID0gc3RhdGUucmVzb3VyY2VEaXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobmV3RGlySW5wdXQpIHtcbiAgICAgICAgICAgICAgICBuZXdEaXJJbnB1dC52YWx1ZSA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJEaXJlY3RvcnlUYWJsZSh0aGlzLmdldExvY2FsZUVudHJpZXMoKSk7XG4gICAgICAgICAgICB2b2lkIHRoaXMudXBkYXRlQ29uZmlybUJ1dHRvbk1vZGUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgaGFuZGxlQ29uZmlybVJlc291cmNlRGlyKCkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZURpciA9IHRoaXMuZ2V0UmVzb3VyY2VEaXIoKTtcbiAgICAgICAgICAgIGlmICghcmVzb3VyY2VEaXIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFske1BBQ0tBR0VfTkFNRX1dYCwgdCgnbG9nX2VudGVyX3Jlc291cmNlX2RpcicpKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1vZGU6IENvbmZpcm1Nb2RlID0gKCh0aGlzIGFzIGFueSkuX2NvbmZpcm1Nb2RlIGFzIENvbmZpcm1Nb2RlKSB8fCAnYWRkJztcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAobW9kZSA9PT0gJ3RyYW5zZmVyJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnRyYW5zZmVyUmVzb3VyY2VEaXIoc3RhdGUucmVzb3VyY2VEaXIsIHJlc291cmNlRGlyKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRMb2coJ3N1Y2Nlc3MnLCB0KCdvcF9kaXJfdHJhbnNmZXJyZWQnLCBzdGF0ZS5yZXNvdXJjZURpciwgcmVzb3VyY2VEaXIpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFske1BBQ0tBR0VfTkFNRX1dYCwgdCgnbG9nX2Rpcl90cmFuc2ZlcnJlZCcsIHN0YXRlLnJlc291cmNlRGlyLCByZXNvdXJjZURpcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlUmVzb3VyY2VEaXJDcmVhdGVkKHJlc291cmNlRGlyKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRMb2coJ3N1Y2Nlc3MnLCB0KCdvcF9kaXJfYWRkZWQnLCB0b1Jlc291cmNlRGJQYXRoKHJlc291cmNlRGlyKSkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfZGlyX2FkZGVkJywgdG9SZXNvdXJjZURiUGF0aChyZXNvdXJjZURpcikpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZVNjaGVtYUZpbGUocmVzb3VyY2VEaXIpO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NoZW1hUGF0aCA9IGpvaW4odG9SZXNvdXJjZUZzUGF0aChyZXNvdXJjZURpciksIFNDSEVNQV9GSUxFX05BTUUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjaGVtYUV4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMoc2NoZW1hUGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKCFzY2hlbWFFeGlzdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRMb2coJ2Vycm9yJywgdCgnb3Bfc2NoZW1hX21pc3NpbmcnLCBzY2hlbWFQYXRoKSk7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgWyR7UEFDS0FHRV9OQU1FfV0gJHt0KCdsb2dfc2NoZW1hX21pc3NpbmcnLCBzY2hlbWFQYXRoKX1gKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmFkZExvZygnc3VjY2VzcycsIHQoJ29wX3NjaGVtYV92ZXJpZmllZCcsIHNjaGVtYVBhdGgpKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfc2NoZW1hX3ZlcmlmaWVkJywgc2NoZW1hUGF0aCkpO1xuICAgICAgICAgICAgICAgIHN0YXRlLnJlc291cmNlRGlyID0gcmVzb3VyY2VEaXI7XG4gICAgICAgICAgICAgICAgdGhpcy5zYXZlU3RhdGUoc3RhdGUpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaFJlc291cmNlc0Fzc2V0RGIoKTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnJlZnJlc2hMb2NhbGVFbnRyaWVzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyTXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTG9nKCdlcnJvcicsIHQoJ29wX3NldF9kaXJfZmFpbGVkJywgZXJyTXNnKSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbJHtQQUNLQUdFX05BTUV9XWAsIHQoJ2xvZ19zZXRfZGlyX2ZhaWxlZCcpLCBlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGFzeW5jIGhhbmRsZUFkZERpcmVjdG9yeSgpIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld0RpcklucHV0ID0gdGhpcy4kLm5ld0RpcklucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgaWYgKCFuZXdEaXJJbnB1dCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VEaXIgPSB0aGlzLmdldFN0YXRlKCkucmVzb3VyY2VEaXIgfHwgdGhpcy5nZXRSZXNvdXJjZURpcigpO1xuICAgICAgICAgICAgaWYgKCFyZXNvdXJjZURpcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfY29uZmlndXJlX2Rpcl9maXJzdCcpKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGxvY2FsZUNvZGUgPSBub3JtYWxpemVMb2NhbGVDb2RlKG5ld0RpcklucHV0LnZhbHVlIHx8ICcnKTtcbiAgICAgICAgICAgIGlmICghbG9jYWxlQ29kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZVJlc291cmNlRGlyQ3JlYXRlZChyZXNvdXJjZURpcik7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5lbnN1cmVTY2hlbWFGaWxlKHJlc291cmNlRGlyKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2FsZUZpbGVOYW1lID0gYCR7bG9jYWxlQ29kZX0uanNvbmA7XG4gICAgICAgICAgICAgICAgY29uc3QgbG9jYWxlRmlsZVBhdGggPSBqb2luKHRvUmVzb3VyY2VGc1BhdGgocmVzb3VyY2VEaXIpLCBsb2NhbGVGaWxlTmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgZXhpc3RzID0gYXdhaXQgcGF0aEV4aXN0cyhsb2NhbGVGaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKGV4aXN0cykge1xuICAgICAgICAgICAgICAgICAgICBuZXdEaXJJbnB1dC52YWx1ZSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZExvZygnd2FybicsIHQoJ29wX2xvY2FsZV9leGlzdHMnLCBsb2NhbGVGaWxlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFske1BBQ0tBR0VfTkFNRX1dYCwgdCgnbG9nX2xvY2FsZV9leGlzdHMnLCBsb2NhbGVGaWxlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IHRoaXMubGlzdExvY2FsZUVudHJpZXMocmVzb3VyY2VEaXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2FsZUNvbnRlbnQgPSAhZW50cmllcy5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgPyBjcmVhdGVEZWZhdWx0TG9jYWxlQ29udGVudChsb2NhbGVDb2RlKVxuICAgICAgICAgICAgICAgICAgICA6IGF3YWl0IHRoaXMuZ2V0VGVtcGxhdGVDb250ZW50KGVudHJpZXMpO1xuXG4gICAgICAgICAgICAgICAgbG9jYWxlQ29udGVudC4kc2NoZW1hID0gU0NIRU1BX0ZJTEVfTkFNRTtcbiAgICAgICAgICAgICAgICBpZiAoIWxvY2FsZUNvbnRlbnQubWV0YSB8fCB0eXBlb2YgbG9jYWxlQ29udGVudC5tZXRhICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KGxvY2FsZUNvbnRlbnQubWV0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxlQ29udGVudC5tZXRhID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxvY2FsZUNvbnRlbnQubWV0YS5jb2RlID0gbG9jYWxlQ29kZTtcbiAgICAgICAgICAgICAgICBpZiAoIWxvY2FsZUNvbnRlbnQubWV0YS52ZXJzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsZUNvbnRlbnQubWV0YS52ZXJzaW9uID0gREVGQVVMVF9MT0NBTEVfVkVSU0lPTjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhd2FpdCB3cml0ZUpzb24obG9jYWxlRmlsZVBhdGgsIGxvY2FsZUNvbnRlbnQsIHsgc3BhY2VzOiAyIH0pO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaFJlc291cmNlc0Fzc2V0RGIoKTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnJlZnJlc2hMb2NhbGVFbnRyaWVzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRMb2coJ3N1Y2Nlc3MnLCB0KCdvcF9sb2NhbGVfYWRkZWQnLCBsb2NhbGVDb2RlKSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVyck1zZyA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZExvZygnZXJyb3InLCB0KCdvcF9hZGRfbG9jYWxlX2ZhaWxlZCcsIGVyck1zZykpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfYWRkX2xvY2FsZV9mYWlsZWQnKSwgZXJyb3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyBzZXRUZW1wbGF0ZShpbmRleDogbnVtYmVyKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuZ2V0TG9jYWxlRW50cmllcygpW2luZGV4XTtcbiAgICAgICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnJlYWRMb2NhbGVKc29uKGVudHJ5LmZ1bGxQYXRoKTtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xuICAgICAgICAgICAgc3RhdGUudGVtcGxhdGVMb2NhbGUgPSB7XG4gICAgICAgICAgICAgICAgZmlsZU5hbWU6IGVudHJ5LmZpbGVOYW1lLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNsb25lSnNvbihjb250ZW50KSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLnNhdmVTdGF0ZShzdGF0ZSk7XG4gICAgICAgICAgICB0aGlzLmFkZExvZygnaW5mbycsIHQoJ29wX3RlbXBsYXRlX3NldCcsIGVudHJ5LmNvZGUpKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gLS0tLSBTeW5jIChkZWxheWVkIGNvbmZpcm0pIC0tLS1cbiAgICAgICAgYXN5bmMgZXhlY3V0ZVN5bmMoaW5kZXg6IG51bWJlcikge1xuICAgICAgICAgICAgY29uc3QgZW50cmllcyA9IHRoaXMuZ2V0TG9jYWxlRW50cmllcygpO1xuICAgICAgICAgICAgY29uc3QgYmFzZUVudHJ5ID0gZW50cmllc1tpbmRleF07XG4gICAgICAgICAgICBpZiAoIWJhc2VFbnRyeSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0RW50cmllcyA9IGVudHJpZXMuZmlsdGVyKChfLCBlbnRyeUluZGV4KSA9PiBlbnRyeUluZGV4ICE9PSBpbmRleCk7XG4gICAgICAgICAgICBpZiAoIXRhcmdldEVudHJpZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRMb2coJ3dhcm4nLCB0KCdzeW5jX25vX3RhcmdldHMnKSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbJHtQQUNLQUdFX05BTUV9XWAsIHQoJ3N5bmNfbm9fdGFyZ2V0cycpKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGJhc2VDb250ZW50ID0gYXdhaXQgdGhpcy5yZWFkTG9jYWxlSnNvbihiYXNlRW50cnkuZnVsbFBhdGgpO1xuICAgICAgICAgICAgbGV0IGNoYW5nZWRDb3VudCA9IDA7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0RW50cnkgb2YgdGFyZ2V0RW50cmllcykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldENvbnRlbnQgPSBhd2FpdCB0aGlzLnJlYWRMb2NhbGVKc29uKHRhcmdldEVudHJ5LmZ1bGxQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3luY2VkQ29udGVudCA9IGJ1aWxkU3luY2VkTG9jYWxlQ29udGVudChiYXNlQ29udGVudCwgdGFyZ2V0Q29udGVudCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKEpTT04uc3RyaW5naWZ5KHRhcmdldENvbnRlbnQpID09PSBKU09OLnN0cmluZ2lmeShzeW5jZWRDb250ZW50KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB3cml0ZUpzb24odGFyZ2V0RW50cnkuZnVsbFBhdGgsIHN5bmNlZENvbnRlbnQsIHsgc3BhY2VzOiAyIH0pO1xuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkQ291bnQgKz0gMTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlcnJNc2cgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkTG9nKCd3YXJuJywgdCgnb3Bfc3luY19mYWlsZWQnLCB0YXJnZXRFbnRyeS5maWxlTmFtZSwgZXJyTXNnKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfc3luY19mYWlsZWQnLCB0YXJnZXRFbnRyeS5maWxlTmFtZSksIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaFJlc291cmNlc0Fzc2V0RGIoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaExvY2FsZUVudHJpZXMoKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKCk7XG5cbiAgICAgICAgICAgIHRoaXMuYWRkTG9nKCdzdWNjZXNzJywgdCgnb3Bfc3luY19jb21wbGV0ZScsIGJhc2VFbnRyeS5maWxlTmFtZSwgU3RyaW5nKGNoYW5nZWRDb3VudCkpKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtQQUNLQUdFX05BTUV9XWAsIHQoJ2xvZ19zeW5jX2NvbXBsZXRlJywgYmFzZUVudHJ5LmZpbGVOYW1lLCBTdHJpbmcoY2hhbmdlZENvdW50KSkpO1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyBvcGVuRGlyZWN0b3J5KGluZGV4OiBudW1iZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5nZXRMb2NhbGVFbnRyaWVzKClbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdvcGVuLWFzc2V0JywgZW50cnkuZGJQYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfb3Blbl9hc3NldF9mYWlsZWQnKSwgZXJyb3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVsZWN0cm9uID0gcmVxdWlyZSgnZWxlY3Ryb24nKTtcbiAgICAgICAgICAgICAgICBpZiAoZWxlY3Ryb24/LnNoZWxsPy5vcGVuUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICBlbGVjdHJvbi5zaGVsbC5vcGVuUGF0aChlbnRyeS5mdWxsUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfZWxlY3Ryb25fdW5hdmFpbGFibGUnKSwgZXJyb3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoKEVkaXRvciBhcyBhbnkpLlNoZWxsPy5vcGVuUGF0aCkge1xuICAgICAgICAgICAgICAgIChFZGl0b3IgYXMgYW55KS5TaGVsbC5vcGVuUGF0aChlbnRyeS5mdWxsUGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmFkZExvZygnd2FybicsIHQoJ29wX29wZW5fZmFpbGVkJywgZW50cnkuZmlsZU5hbWUpKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgWyR7UEFDS0FHRV9OQU1FfV1gLCB0KCdsb2dfY2Fubm90X29wZW4nLCBlbnRyeS5mdWxsUGF0aCkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIC0tLS0gRGVsZXRlIChkZWxheWVkIGNvbmZpcm0pIC0tLS1cbiAgICAgICAgYXN5bmMgZXhlY3V0ZURlbGV0ZShpbmRleDogbnVtYmVyKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuZ2V0TG9jYWxlRW50cmllcygpW2luZGV4XTtcbiAgICAgICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvZGUgPSBlbnRyeS5jb2RlO1xuICAgICAgICAgICAgYXdhaXQgcmVtb3ZlKGVudHJ5LmZ1bGxQYXRoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaFJlc291cmNlc0Fzc2V0RGIoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaExvY2FsZUVudHJpZXMoKTtcbiAgICAgICAgICAgIHRoaXMuYWRkTG9nKCdzdWNjZXNzJywgdCgnb3BfZGVsZXRlX2NvbXBsZXRlJywgY29kZSkpO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyAtLS0tIEV2ZW50IGJpbmRpbmcgLS0tLVxuICAgICAgICBiaW5kRXZlbnRzKCkge1xuICAgICAgICAgICAgY29uc3QgY29uZmlybUJ0biA9IHRoaXMuJC5jb25maXJtUmVzb3VyY2VEaXJCdG4gYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgY29uc3QgYWRkQnRuID0gdGhpcy4kLmFkZERpckJ0biBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gICAgICAgICAgICBjb25zdCBuZXdEaXJJbnB1dCA9IHRoaXMuJC5uZXdEaXJJbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IGRpclRhYmxlQm9keSA9IHRoaXMuJC5kaXJUYWJsZUJvZHkgYXMgSFRNTFRhYmxlU2VjdGlvbkVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VEaXJJbnB1dCA9IHRoaXMuJC5yZXNvdXJjZURpcklucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuXG4gICAgICAgICAgICBjb25maXJtQnRuPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgICB2b2lkIHRoaXMuaGFuZGxlQ29uZmlybVJlc291cmNlRGlyKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFkZEJ0bj8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdm9pZCB0aGlzLmhhbmRsZUFkZERpcmVjdG9yeSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXNvdXJjZURpcklucHV0Py5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHZvaWQgdGhpcy51cGRhdGVDb25maXJtQnV0dG9uTW9kZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBuZXdEaXJJbnB1dD8uYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChldmVudC5rZXkgPT09ICdFbnRlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgdm9pZCB0aGlzLmhhbmRsZUFkZERpcmVjdG9yeSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkaXJUYWJsZUJvZHk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50OiBFdmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3QgYnV0dG9uID0gdGFyZ2V0Py5jbG9zZXN0KCdidXR0b25bZGF0YS1hY3Rpb25dW2RhdGEtaW5kZXhdJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgICAgIGlmICghYnV0dG9uIHx8IGJ1dHRvbi5kaXNhYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgYWN0aW9uID0gYnV0dG9uLmRhdGFzZXQuYWN0aW9uO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gTnVtYmVyKGJ1dHRvbi5kYXRhc2V0LmluZGV4KTtcbiAgICAgICAgICAgICAgICBpZiAoTnVtYmVyLmlzTmFOKGluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gQWN0aW9ucyB0aGF0IGRvbid0IG5lZWQgY29uZmlybWF0aW9uXG4gICAgICAgICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ29wZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5vcGVuRGlyZWN0b3J5KGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnc2V0LXRlbXBsYXRlJykge1xuICAgICAgICAgICAgICAgICAgICB2b2lkIHRoaXMuc2V0VGVtcGxhdGUoaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gLS0tLSBEZWxheWVkLWNvbmZpcm0gYWN0aW9ucyAtLS0tXG5cbiAgICAgICAgICAgICAgICAvLyBDbGlja2luZyBhIGNvbmZpcm0tc3RhdGUgYnV0dG9uIOKGkiBleGVjdXRlIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ2NvbmZpcm0tZGVsZXRlJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsZWFyQ29uZmlybVN0YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5leGVjdXRlRGVsZXRlKGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnY29uZmlybS1zeW5jJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsZWFyQ29uZmlybVN0YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5leGVjdXRlU3luYyhpbmRleCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBDbGlja2luZyBcImRlbGV0ZVwiIG9yIFwic3luY1wiIGZvciB0aGUgZmlyc3QgdGltZSDihpIgYXJtIGNvbmZpcm0gc3RhdGVcbiAgICAgICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnZGVsZXRlJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFybUNvbmZpcm1TdGF0ZShpbmRleCwgJ2RlbGV0ZScpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChhY3Rpb24gPT09ICdzeW5jJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFybUNvbmZpcm1TdGF0ZShpbmRleCwgJ3N5bmMnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gQ2xpY2tpbmcgb3V0c2lkZSB0aGUgdGFibGUgKG9yIGFueXdoZXJlIG9uIHRoZSBwYW5lbCkgY2xlYXJzIGNvbmZpcm0gc3RhdGVcbiAgICAgICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuJC5hcHAgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgYXBwPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudDogRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgICAgIC8vIE9ubHkgY2xlYXIgaWYgY2xpY2tpbmcgb3V0c2lkZSBhIGNvbmZpcm0tYWN0aW9uIGJ1dHRvblxuICAgICAgICAgICAgICAgIGNvbnN0IGlzQ29uZmlybUJ1dHRvbiA9IHRhcmdldD8uY2xvc2VzdCgnW2RhdGEtYWN0aW9uPVwiY29uZmlybS1kZWxldGVcIl0sIFtkYXRhLWFjdGlvbj1cImNvbmZpcm0tc3luY1wiXSwgW2RhdGEtYWN0aW9uPVwiZGVsZXRlXCJdLCBbZGF0YS1hY3Rpb249XCJzeW5jXCJdJyk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0NvbmZpcm1CdXR0b24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhckNvbmZpcm1TdGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBhc3luYyBpbml0aWFsaXplUGFuZWwoKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsaXplU3RhdGljVGV4dCgpO1xuICAgICAgICAgICAgdGhpcy5iaW5kRXZlbnRzKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmxvYWRTdGF0ZSgpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWZyZXNoTG9jYWxlRW50cmllcygpO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICAgICAgfSxcbiAgICB9LFxuICAgIHJlYWR5KCkge1xuICAgICAgICB2b2lkIHRoaXMuaW5pdGlhbGl6ZVBhbmVsKCk7XG4gICAgfSxcbiAgICBiZWZvcmVDbG9zZSgpIHt9LFxuICAgIGNsb3NlKCkge30sXG59KTtcbiJdfQ==