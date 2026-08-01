/**
 * pure.ts - i18n 纯 TS 入口（零 Cocos 依赖）
 * @description 可用于 ViewModel、单元测试、Node.js 脚本等非 Cocos 运行时环境。
 *              所有导出模块及其传递依赖均不包含 `from 'cc'` 导入。
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-06-10
 */

// ──────────── 静态门面（ViewModel 中直接调用）────────────
export { I18n } from './core/I18n';

// ──────────── Null Object（测试/SSR 场景使用）────────────
export { DefaultI18nManager } from './core/DefaultI18nManager';

// ──────────── 接口 ────────────
export type { II18nManager } from './core/II18nManager';

// ──────────── 工具 ────────────
export { DateFormatter } from './core/DateFormatter';

// ──────────── 枚举 & 类型 ────────────
export { I18nLabelMode } from './core/II18nManager';
export { I18nEventType } from './core/I18nEvent';
export type {
  I18nLanguageBeforeSwitchEvent,
  I18nLanguageSwitchedEvent,
  I18nLanguageSwitchErrorEvent,
} from './core/I18nEvent';
