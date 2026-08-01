/**
 * I18n.ts - 国际化模块静态类（Null Object 兜底）
 * @description 该类提供全局访问接口，自动回退到 DefaultI18nManager 确保 ViewModel 中
 *              的调用永不崩溃。所有方法代理到 II18nManager 的具体实现。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/i18n/i18n}
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-03-15
 * @modified 2026-06-11
 */

import { II18nManager } from "./II18nManager";
import { DefaultI18nManager } from "./DefaultI18nManager";

/**
 * 模块级私有状态。
 * 不挂载在 I18n 类上，避免通过 pure.ts 导出暴露给外部使用者。
 */
let _currentI18nManager: II18nManager | undefined;

/**
 * @internal 绑定真实 Manager（由 I18nManager 构造函数自动调用）
 *
 * 本函数不通过 pure.ts / index.ts 重导出，外部使用者无法访问。
 */
export function __bindI18n(manager: II18nManager): void {
  _currentI18nManager = manager;
}

/**
 * @internal 解绑 Manager
 */
export function __unbindI18n(manager: II18nManager): void {
  if (_currentI18nManager === manager) {
    _currentI18nManager = undefined;
  }
}

/** i18n 静态门面 */
export class I18n {
  /**
   * 获取当前 Manager。
   * 若未绑定真实 I18nManager，自动回退到 DefaultI18nManager（Null Object），
   * 确保 ViewModel 中的调用永不因未绑定而崩溃。
   */
  private static get current(): II18nManager {
    return _currentI18nManager ?? DefaultI18nManager.instance;
  }

  // ── 属性 ──

  /** 当前语言代码 */
  static get language(): string {
    return I18n.current.language;
  }

  /** 当前回退语言代码（未设置时返回 null） */
  static get fallbackLanguage(): string | null {
    return I18n.current.fallbackLanguage;
  }

  // ── 操作 ──

  /**
   * 切换语言
   * @param language 语言代码（如 "en"）
   */
  static async switch(language: string): Promise<void> {
    return I18n.current.switch(language);
  }

  /**
   * 获取多语言文本（编辑器绑定专用，仅支持字符串参数）
   * @param key 多语言文本路径（支持点语法，如 "common.confirm"）
   * @param args 可选的字符串参数数组，用于替换文本中的 {0} {1} 占位符
   * @returns 多语言文本，未找到时返回 key 本身作为 fallback
   */
  static text(key: string, args?: string[]): string {
    return I18n.current.text(key, args);
  }

  /**
   * 获取多语言文本（格式化版，ViewModel 专用）
   * @param key 多语言文本路径（支持点语法）
   * @param args 可选的参数数组，Date 类型根据语言 meta 自动格式化
   * @returns 多语言文本，未找到时返回 key 本身作为 fallback
   */
  static format(key: string, args?: any[]): string {
    return I18n.current.format(key, args);
  }

  /**
   * 设置回退语言
   * 当 key 在当前语言中找不到时，会回退到该语言的翻译
   * @param language 语言代码（如 "zh"）
   */
  static async setFallbackLanguage(language: string): Promise<void> {
    return I18n.current.setFallbackLanguage(language);
  }

  /** 清除回退语言 */
  static clearFallbackLanguage(): void {
    I18n.current.clearFallbackLanguage();
  }

}
