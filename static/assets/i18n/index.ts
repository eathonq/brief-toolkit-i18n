/**
 * index.ts - 国际化模块入口
 * @description 该模块提供国际化（i18n）相关的组件和功能，帮助开发者实现多语言支持和本地化。
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.2.0
 *
 * @created 2024-08-16
 * @modified 2026-06-20
 *
 * @note ViewModel 中请使用 pure.ts 入口，该入口零 Cocos 依赖、永不崩溃。
 */

// ──────────── Cocos Component（挂载到场景节点）────────────
export { I18nManager } from "./core/I18nManager";
export { I18nSetting } from "./components/I18nSetting";
export { I18nLabel } from "./components/I18nLabel";
export { I18nSprite } from "./components/I18nSprite";

// ──────────── 数据类型（依赖 cc 的类型，不通过 pure 导出）────────────
export type { LanguageMeta } from "./core/I18nManager";

// ──────────── 纯 TS API（ViewModel 可用，零 Cocos 依赖）────────────
export * from './pure';
