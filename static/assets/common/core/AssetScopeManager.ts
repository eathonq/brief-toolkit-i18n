/**
 * AssetScopeManager.ts - 资源作用域管理器
 * @description 全局单例，组件通过它加载资源，不需要关心当前属于哪个 Scope。
 *
 * ## 架构
 *   AssetScopeManager (全局单例) ← 组件唯一入口
 *        │
 *        ├─ _scopeStack: AssetScope[]  ← 支持叠加场景
 *        ├─ _defaultScope: AssetScope  ← 兜底，current 永不为 null
 *        │
 *        └─ loadSpriteFrame / loadJsonAsset / getPrefab / getAudioClip → 委托 current
 *
 * ## 场景接入
 *   场景根节点挂 AssetScopeMount 组件 → onLoad push / onDestroy pop
 *   不挂 Mount → 自动走 _defaultScope（永不释放，开发期会 warn）
 *
 * ## 复杂场景手动控制
 *   const subScope = new AssetScope('skill');
 *   const sf = await subScope.getSpriteFrame(path);
 *   subScope.releaseAll();  // 独立释放，不影响 Manager.current
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-06-19
 */

import { SpriteFrame, JsonAsset, Prefab, AudioClip, Node, Sprite, Asset } from 'cc';
import { AssetScope } from './AssetScope';

/**
 * 资源作用域管理器
 * - 全局单例，组件通过它加载资源，不需要关心当前属于哪个 Scope。
 * - 由 AssetScopeMount 组件在场景 onLoad / onDestroy 时自动 push / pop。
 * - 不挂 Mount → 自动走 _defaultScope（永不释放，开发期会 warn）。
 */
export class AssetScopeManager {
  // ────────── 当前作用域 ──────────
  /** 作用域栈（支持叠加场景） */
  private static _scopeStack: AssetScope[] = [];

  /** 默认兜底作用域（永不释放，确保 current 永不为 null） */
  private static _defaultScope = new AssetScope('__global__');

  /**
   * 当前活跃作用域。
   * - 栈非空 → 栈顶 scope
   * - 栈为空 → _defaultScope（兜底，不释放）
   */
  static get current(): AssetScope {
    if (this._scopeStack.length > 0) {
      return this._scopeStack[this._scopeStack.length - 1];
    }
    return this._defaultScope;
  }

  /** 生产模式下无 Mount 场景是否告警 */
  private static _warnedMissingMount = false;

  // ────────── 去抖（setNodeSprite 用）──────────
  private static _requestId = 0;
  private static _targetRequestMap: WeakMap<object, number> = new WeakMap<object, number>();

  // ────────── 场景生命周期 ──────────
  /**
   * 场景进入：推入新 Scope 到栈顶。
   * 由 AssetScopeMount.onLoad() 调用。
   *
   * @param name 作用域名（建议场景名，如 "battle"）
   * @returns 新创建的 AssetScope
   */
  static push(name: string): AssetScope {
    const scope = new AssetScope(name);
    this._scopeStack.push(scope);
    return scope;
  }

  /**
   * 场景退出：弹出栈顶 Scope 并自动 releaseAll。
   * 由 AssetScopeMount.onDestroy() 调用。
   *
   * @param expectedName 可选断言：弹出时校验 scope 名是否匹配
   */
  static pop(expectedName?: string): void {
    const scope = this._scopeStack.pop();
    if (scope) {
      if (expectedName && scope.name !== expectedName) {
        console.warn(
          `[AssetScopeManager] pop 断言失败：期望 "${expectedName}"，实际 "${scope.name}"。` +
          `请检查场景 Mount 的 scopeName 是否匹配。`
        );
      }
      scope.releaseAll();
    }
  }

  // ────────── 组件统一 API ──────────

  /**
   * 通用资源加载（异步）。
   * 根据路径自动解析 bundle、加载本地或远程资源。
   * @param raw 资源路径，支持本地 / db:// / 远程 URL
   * @param type 可选：Cocos Asset 类型构造函数（如 Prefab, AudioClip 等），不传则不做运行时类型校验
   * @returns 加载成功返回对应类型的资产实例，失败返回 null
   * @example
   *   CCAssets.loadAsset<Prefab>('db://game/prefab/MyPrefab', Prefab);
   *   CCAssets.loadAsset<AudioClip>('audio/bgm', AudioClip);
   *   CCAssets.loadAsset<SpriteFrame>('image/icon', SpriteFrame);
   */
  static async loadAsset<T extends Asset>(raw: string, type?: new (...args: any[]) => T): Promise<T | null> {
    this._warnIfNoMount();
    return this.current.loadAsset(raw, type);
  }

  /**
   * 获取 SpriteFrame（异步），加载成功后自动追踪路径。
   * 路径命中 Cocos 引擎缓存时无 IO 开销。
   *
   * @param raw 资源路径（完整 db:// 格式）
   */
  static async getSpriteFrame(raw: string): Promise<SpriteFrame | null> {
    this._warnIfNoMount();
    return this.current.getSpriteFrame(raw);
  }

  /**
   * 获取 JsonAsset（异步），加载成功后自动追踪路径。
   * 路径命中 Cocos 引擎缓存时无 IO 开销。
   *
   * @param raw 资源路径（完整 db:// 格式）
   */
  static async getJsonAsset(raw: string): Promise<JsonAsset | null> {
    this._warnIfNoMount();
    return this.current.getJsonAsset(raw);
  }

  /**
   * 获取 Prefab（异步），加载成功后自动追踪路径。
   * 路径命中 Cocos 引擎缓存时无 IO 开销。
   *
   * @param raw 资源路径（完整 db:// 格式）
   */
  static async getPrefab(raw: string): Promise<Prefab | null> {
    this._warnIfNoMount();
    return this.current.getPrefab(raw);
  }

  /**
   * 获取 AudioClip（异步），加载成功后自动追踪路径。
   * 路径命中 Cocos 引擎缓存时无 IO 开销。
   *
   * @param raw 资源路径（完整 db:// 格式）
   */
  static async getAudioClip(raw: string): Promise<AudioClip | null> {
    this._warnIfNoMount();
    return this.current.getAudioClip(raw);
  }

  /**
   * 设置节点/精灵的 SpriteFrame（含请求去抖 + scope 追踪）。
   * 通过当前 scope 加载 SpriteFrame（自动追踪），加载成功后应用到 target。
   * 若传入 Node 且无 Sprite 组件 → warn 并跳过。
   *
   * @param target Node 或 Sprite 组件实例
   * @param raw 资源路径
   */
  static setNodeSprite(target: Node | Sprite, raw: string): void {
    this._warnIfNoMount();
    const key = target as unknown as object;
    const requestId = ++this._requestId;
    this._targetRequestMap.set(key, requestId);

    this.current.getSpriteFrame(raw).then((spriteFrame) => {
      if (!spriteFrame) return;
      if (this._targetRequestMap.get(key) !== requestId) return;
      if ((target as any).isValid === false) return;

      if (target instanceof Node) {
        const sprite = target.getComponent(Sprite);
        if (!sprite) {
          console.warn(
            `[AssetScopeManager] setNodeSprite: 节点 "${target.name}" 没有 Sprite 组件，操作已忽略。` +
            `请先挂载 Sprite 组件再调用 setNodeSprite。`,
          );
          return;
        }
        if (sprite.isValid !== false) {
          sprite.spriteFrame = spriteFrame;
        }
        return;
      }

      // target is Sprite
      if (target.isValid !== false) {
        target.spriteFrame = spriteFrame;
      }
    });
  }

  // ────────── 调试 ──────────

  /** 当前栈深度 */
  static get stackDepth(): number {
    return this._scopeStack.length;
  }

  /** 输出所有 scope 信息 */
  static debug(): { stackDepth: number; scopes: ReturnType<AssetScope['debug']>[] } {
    return {
      stackDepth: this._scopeStack.length,
      scopes: this._scopeStack.map(s => s.debug()),
    };
  }

  // ────────── 内部 ──────────

  /**
   * 运行时如果栈为空、走到了 _defaultScope 兜底，
   * 说明当前场景没挂 AssetScopeMount。
   * 开发期 warn 一次提醒接入。
   */
  private static _warnIfNoMount(): void {
    if (this._scopeStack.length === 0 && !this._warnedMissingMount) {
      this._warnedMissingMount = true;
      console.warn(
        '[AssetScopeManager] 当前场景未检测到 AssetScopeMount 组件，' +
        '资源将加载到 __global__ scope（永不释放）。请在场景根节点挂载 AssetScopeMount 以启用自动释放。'
      );
    }
  }
}
