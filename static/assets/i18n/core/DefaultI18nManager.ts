/**
 * DefaultI18nManager.ts — II18nManager 的默认空实现（Null Object Pattern）
 * @description 在真实 I18nManager 绑定前提供安全的空操作，确保 ViewModel 中的
 *              I18n 调用永不因未绑定而崩溃。
 *              - text() 返回 key 本身作为兜底显示
 *              - switch() / setFallbackLanguage() 输出 console.debug 便于排查
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-10
 * @modified 2026-06-20
 */

import { II18nManager } from "./II18nManager";

export class DefaultI18nManager implements II18nManager {
  static readonly instance = new DefaultI18nManager();

  get language(): string {
    return "";
  }

  get fallbackLanguage(): string | null {
    return null;
  }

  async switch(language: string): Promise<void> {
    console.debug(`[I18n] DefaultI18nManager.switch("${language}") — real manager not bound yet`);
  }

  text(key: string, _args?: string[]): string {
    return key;
  }

  format(key: string, _args?: any[]): string {
    return key;
  }

  async setFallbackLanguage(language: string): Promise<void> {
    console.debug(`[I18n] DefaultI18nManager.setFallbackLanguage("${language}") — real manager not bound yet`);
  }

  clearFallbackLanguage(): void {}
}
