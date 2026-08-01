/**
 * AssetScope.ts - 资源作用域
 * @description 按实例追踪资源路径，支持统一释放。
 *              每个场景/模块创建一个独立的 AssetScope 实例，通过 scope 加载的资源
 *              由 scope.releaseAll() 统一释放，不依赖组件的 onDestroy 逐个清理。
 *
 * ## 跨 Scope 共享
 *   依赖 Cocos AssetManager 自带 ref-count：
 *     bundle.load() → refCount++,  bundle.release() → refCount--,
 *     refCount 归零时引擎自动释放纹理。
 *   两个 Scope 各自加载同一 path 时各贡献 1 个 refCount，互不感知却正确协作。
 *
 * ## 生命周期
 *   const scope = new AssetScope('battle');
 *   const sf = await scope.getSpriteFrame(path);  // 加载并自动追踪
 *   scope.track(path);                             // 手动追踪外部加载的资源
 *   scope.releaseAll();                            // 统一释放，零泄漏
 *
 * ## 预加载
 *   AssetScope 不做逐资源预加载。批量预加载请使用 Cocos Creator 原生 API：
 *     resources.preloadDir('textures/ui', SpriteFrame, onProgress, onComplete);
 *   预加载后 scope.getSpriteFrame() 命中引擎缓存，零 IO。
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-06-19
 */

import { SpriteFrame, JsonAsset, Prefab, AudioClip, Asset } from 'cc';
import { CCAssets } from './CCAssets';

/** 资源作用域 */
export class AssetScope {
  constructor(name: string) {
    this._name = name;
  }

  /** 作用域名（调试用） */
  private _name: string;
  /** 作用域名 */
  get name(): string { return this._name; }

  /** 本 Scope 追踪的所有资源路径（供 releaseAll 使用） */
  private _raws = new Set<string>();
  /** 已追踪的资源路径数量 */
  get rawCount(): number { return this._raws.size; }

  // ────────── 加载 / 追踪 ──────────

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
  async loadAsset<T extends Asset = Asset>(raw: string, type?: { new(...args: any[]): T }): Promise<T | null> {
    const asset = await CCAssets.loadAsset(raw, type);
    if (asset) {
      this._raws.add(raw);
    }
    return asset;
  }

  /**
   * 获取 SpriteFrame（异步），加载成功后自动追踪路径。
   * 路径命中 Cocos 引擎缓存时无 IO 开销。
   *
   * @param raw 资源路径（完整 db:// 格式）
   */
  async getSpriteFrame(raw: string): Promise<SpriteFrame | null> {
    const sf = await CCAssets.getSpriteFrame(raw);
    if (sf) {
      this._raws.add(raw);
    }
    return sf;
  }

  /**
   * 获取 JsonAsset（异步），加载成功后自动追踪路径。
   * 切换 scope 时由 releaseAll() 统一释放，无需手动 releaseAsset。
   *
   * @param raw 资源路径
   */
  async getJsonAsset(raw: string): Promise<JsonAsset | null> {
    const asset = await CCAssets.getJsonAsset(raw);
    if (asset) {
      this._raws.add(raw);
    }
    return asset;
  }

  /**
   * 获取 Prefab（异步），加载成功后自动追踪路径。
   * @param raw 预制体路径（完整 db:// 格式）
   */
  async getPrefab(raw: string): Promise<Prefab | null> {
    const prefab = await CCAssets.getPrefab(raw);
    if (prefab) {
      this._raws.add(raw);
    }
    return prefab;
  }

  /**
   * 获取 AudioClip（异步），加载成功后自动追踪路径。
   * @param raw 音频路径（完整 db:// 格式）
   */
  async getAudioClip(raw: string): Promise<AudioClip | null> {
    const clip = await CCAssets.getAudioClip(raw);
    if (clip) {
      this._raws.add(raw);
    }
    return clip;
  }

  /**
   * 手动追踪外部加载的资源路径。
   * 用于已在别处通过 CCAssets 加载、但需要纳入本 Scope 统一释放的资源。
   *
   * @param raw 资源路径
   */
  track(raw: string): void {
    this._raws.add(raw);
  }

  // ────────── 释放 ──────────

  /**
   * 释放本 Scope 追踪的所有资源。
   * 对每个 path 调用 CCAssets.releasePath() → bundle.release()，
   * Cocos AssetManager refCount--，归零时引擎自动释放纹理。
   *
   * 释放后清空内部追踪（重复调用安全）。
   */
  releaseAll(): void {
    for (const raw of this._raws) {
      CCAssets.releasePath(raw);
    }
    this._raws.clear();
  }

  // ────────── 调试 ──────────

  /**
   * 返回调试信息快照。
   */
  debug(): { name: string; pathCount: number; paths: string[] } {
    return {
      name: this._name,
      pathCount: this._raws.size,
      paths: [...this._raws].sort(),
    };
  }
}
