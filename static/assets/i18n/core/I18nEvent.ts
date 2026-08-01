/**
 * I18nEvent.ts - 国际化事件定义
 * @description 定义语言切换生命周期事件类型与载荷接口。
 *              组件通过订阅 LANGUAGE_SWITCHED 事件驱动 UI 刷新，
 *              替代原先 updateRenderers() 的全场景遍历方案。
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-06-10
 */

/** i18n 事件类型枚举 */
export enum I18nEventType {
  /** 语言切换开始（即将加载新语言资源） */
  LANGUAGE_BEFORE_SWITCH = 'i18n:before-switch',
  /** 语言切换完成（新语言已加载并生效） */
  LANGUAGE_SWITCHED = 'i18n:switched',
  /** 语言切换失败（资源加载失败或解析出错） */
  LANGUAGE_SWITCH_ERROR = 'i18n:switch-error',
}

/** LANGUAGE_BEFORE_SWITCH 事件载荷 */
export interface I18nLanguageBeforeSwitchEvent {
  /** 当前语言代码（空字符串表示尚未设置语言） */
  from: string;
  /** 目标语言代码 */
  to: string;
}

/** LANGUAGE_SWITCHED 事件载荷 */
export interface I18nLanguageSwitchedEvent {
  /** 已生效的语言代码 */
  language: string;
}

/** LANGUAGE_SWITCH_ERROR 事件载荷 */
export interface I18nLanguageSwitchErrorEvent {
  /** 切换前的语言代码 */
  from: string;
  /** 试图切换到的语言代码 */
  to: string;
  /** 错误详情 */
  error: Error;
}
