/**
 * I18nEditorBridge.ts - 国际化编辑器桥接模块
 * @description 该模块提供国际化（i18n）相关的编辑器桥接功能，提供图片 UUID 解析。
 * 
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-15
 * @modified 2026-03-15
 */

export type I18nEditorSpriteUuidResolver = (imagePath: string) => Promise<string | null>;

type GlobalResolverHolder = {
  __BTK_I18N_EDITOR_SPRITE_UUID_RESOLVER?: I18nEditorSpriteUuidResolver;
};

/** 获取当前编辑器图片 uuid 解析器 */
export function getI18nEditorSpriteUuidResolver(): I18nEditorSpriteUuidResolver | null {
  return (globalThis as GlobalResolverHolder).__BTK_I18N_EDITOR_SPRITE_UUID_RESOLVER ?? null;
}
