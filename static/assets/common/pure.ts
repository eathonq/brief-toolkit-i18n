/**
 * pure.ts - Common 纯 TS 入口（零 Cocos 依赖）
 * @description 可用于 ViewModel、单元测试、Node.js 脚本等非 Cocos 运行时环境。
 *              所有导出模块及其传递依赖均不包含 `from 'cc'` 导入。
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-20
 * @modified 2026-06-30
 */

// ──────────── 统一事件总线 ────────────
export { EventBus } from './core/EventBus';
export type { SubscriptionToken, EventCallback } from './core/EventBus';

// ──────────── 并发控制 ────────────
export { EventMutex } from './core/EventMutex';
