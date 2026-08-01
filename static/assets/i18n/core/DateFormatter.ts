/**
 * DateFormatter.ts - 日期格式化工具（纯 TS，零 Cocos 依赖）
 * @description 根据格式模板将 Date 对象转换为本地化字符串。
 *              支持模式：yyyy MM dd HH hh mm ss fff M d H h m s
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-06-10
 */

export class DateFormatter {
  /**
   * 格式化日期
   * @param date 日期对象
   * @param pattern 格式模板，例如 "yyyy年MM月dd日 HH:mm:ss"
   * @returns 格式化后的字符串
   *
   * @example
   * DateFormatter.format(new Date(), "yyyy-MM-dd");          // "2026-06-10"
   * DateFormatter.format(new Date(), "yyyy年MM月dd日");       // "2026年06月10日"
   * DateFormatter.format(new Date(), "hh:mm:ss a");           // "02:30:00 PM"
   */
  static format(date: Date, pattern: string): string {
    if (!date || !pattern) return '';

    const dict: Record<string, string | number> = {
      // 4 位年份
      yyyy: date.getFullYear(),

      // 2 位补齐
      MM: ('' + (date.getMonth() + 101)).substring(1),
      dd: ('' + (date.getDate() + 100)).substring(1),
      HH: ('' + (date.getHours() + 100)).substring(1),
      hh: ('' + ((date.getHours() % 12 || 12) + 100)).substring(1),
      mm: ('' + (date.getMinutes() + 100)).substring(1),
      ss: ('' + (date.getSeconds() + 100)).substring(1),
      fff: ('' + (date.getMilliseconds() + 1000)).substring(1),

      // 1 位（不补齐）
      M: date.getMonth() + 1,
      d: date.getDate(),
      H: date.getHours(),
      h: date.getHours() % 12 || 12,
      m: date.getMinutes(),
      s: date.getSeconds(),
    };

    return pattern.replace(
      /yyyy|MM|dd|HH|hh|mm|ss|fff|M|d|H|h|m|s/g,
      (key) => String(dict[key] ?? key)
    );
  }
}
