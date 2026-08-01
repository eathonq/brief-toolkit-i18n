/**
 * II18nManager.ts - 本地化管理接口
 * @description 该接口定义了本地化管理器的核心功能，包括语言切换和文本获取等。
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-03-15
 * @modified 2026-06-10（扩展事件/状态/回退签名 + 接口重命名）
 */

/** 本地化显示模式 */
export enum I18nLabelMode {
  /** 解析数据 */
  DATA = 0,
  /** 路径数据 */
  PATH = 1,
}

/**
 * 本地化管理接口
 * @description 所有方法由 I18nManager（Cocos 实现）和 DefaultI18nManager（Null Object）共同实现。
 *              ViewModel 层通过 I18n 静态门面调用，永不直接依赖实现类。
 */
export interface II18nManager {
  /** 当前语言代码 */
  readonly language: string;

  /** 当前回退语言代码（未设置时返回 null） */
  readonly fallbackLanguage: string | null;

  /**
   * 切换语言
   * @param language 语言代码
   */
  switch(language: string): Promise<void>;

  /**
   * 获取多语言文本（编辑器绑定专用）
   * @param key 多语言文本路径（支持点语法，如 "common.confirm"）
   * @param args 可选的字符串参数数组，用于替换文本中的 {0} {1} 等占位符
   * @returns 多语言文本，如果未找到则返回路径本身作为 fallback
   * @example
   * i18nManager.text("common.confirm");       // "确定"
   * i18nManager.text("args.welcome", ["Game"]); // "欢迎来到Game!"
   */
  text(key: string, args?: string[]): string;

  /**
   * 获取多语言文本（格式化版，ViewModel 专用）
   * @param key 多语言文本路径（支持点语法）
   * @param args 可选的参数数组，支持 Date / 数字 / 字符串等类型
   *             Date 类型会根据语言 meta 中的 dateFormat/dateTimeFormat 自动格式化
   * @returns 多语言文本，如果未找到则返回路径本身作为 fallback
   * @example
   * I18n.format("time_now", [new Date()]);        // "当前时间：2026年06月10日 14:30:00"
   * I18n.format("publish_at", [new Date("2026-06-10")]); // "发布于 2026年06月10日"
   */
  format(key: string, args?: any[]): string;

  /**
   * 设置回退语言
   * 当 key 在当前语言中找不到时，会回退到该语言的翻译
   * @param language 语言代码（如 "zh"）
   */
  setFallbackLanguage(language: string): Promise<void>;

  /** 清除回退语言 */
  clearFallbackLanguage(): void;
}
