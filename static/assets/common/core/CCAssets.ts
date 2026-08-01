/**
 * CCAssets.ts - 统一资源管理工具
 * @description 提供资源加载、缓存与释放的统一入口，支持本地 bundle、远程 URL 等多种资源路径格式。
 *              合并自 i18n / mvvm / uim 三个模块的独立实现，消除代码重复并统一路径解析行为。
 *
 * ## 路径语法
 *   'image/icon'                  主包 resources 相对路径
 *   'db://game/image/icon'        bundle 资源（game 为 bundle 名）
 *   'https://cdn.example.com/icon.png'  远程地址（仅 SpriteFrame）
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-21
 */

import {
  Asset, AssetManager, SpriteFrame, Texture2D,
  assetManager, resources, JsonAsset, AudioClip,
  Prefab, TextAsset, ImageAsset
} from 'cc';

const _res_ = 'resources';
export type SpriteLoadFormate = "spriteFrame" | "texture";

/** 统一资源管理类 —— 静态方法，提供全局资源加载/释放能力 */
export class CCAssets {
  private static _bundleMap: Map<string, AssetManager.Bundle> = new Map<string, AssetManager.Bundle>([
    [_res_, resources]
  ]);
  private static _bundleLoadingMap: Map<string, Promise<AssetManager.Bundle | null>> = new Map<string, Promise<AssetManager.Bundle | null>>();
  private static _remoteSpriteFrameCache: Map<string, SpriteFrame> = new Map<string, SpriteFrame>();
  private static _remoteLoadingMap: Map<string, Promise<SpriteFrame | null>> = new Map<string, Promise<SpriteFrame | null>>();

  // ═══════════════════════════════════════════════════════════
  // 路径解析
  // ═══════════════════════════════════════════════════════════

  /** 规范化资源路径（用于 resources/bundle.load） */
  private static _normalizeAssetPath(raw: string): string {
    let normalized = (raw ?? '').trim();
    if (!normalized) return '';

    normalized = normalized.replace(/\\/g, '/');

    if (normalized.startsWith('assets/resources/')) {
      normalized = normalized.slice('assets/resources/'.length);
    } else if (normalized.startsWith('resources/')) {
      normalized = normalized.slice('resources/'.length);
    }

    // 去掉常见图片扩展名
    normalized = normalized.replace(/\.(png|jpg|jpeg|webp)$/i, '');

    // 去掉子资源路径后缀（/spriteFrame, /texture）
    normalized = normalized.replace(/\/(spriteFrame|texture)$/i, '');

    return normalized;
  }

  /** 解析资源路径，返回标准化后的 path、bundle 名与是否远程 */
  private static _parsePath(raw: string): { path: string; bundle?: string; isRemote: boolean } {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) {
      return { path: '', isRemote: false };
    }

    // 远程 URL
    if (/^https?:\/\//i.test(trimmed)) {
      return { path: trimmed, isRemote: true };
    }

    // db:// 协议
    if (trimmed.startsWith('db://')) {
      const inner = trimmed.slice(5);
      if (inner.startsWith('assets/resources/')) {
        return {
          bundle: _res_,
          path: this._normalizeAssetPath(inner),
          isRemote: false,
        };
      }
      const firstSlash = inner.indexOf('/');
      if (firstSlash <= 0) {
        return { path: '', isRemote: false };
      }
      return {
        bundle: inner.slice(0, firstSlash),
        path: this._normalizeAssetPath(inner.slice(firstSlash + 1)),
        isRemote: false,
      };
    }

    // 主包相对路径
    return { path: this._normalizeAssetPath(trimmed), isRemote: false };
  }

  // ═══════════════════════════════════════════════════════════
  // Bundle 管理
  // ═══════════════════════════════════════════════════════════

  private static _loadBundle(name: string, url?: string, version?: string): Promise<AssetManager.Bundle | null> {
    const loaded = this._bundleMap.get(name);
    if (loaded) {
      return Promise.resolve(loaded);
    }

    const loading = this._bundleLoadingMap.get(name);
    if (loading) {
      return loading;
    }

    const promise = new Promise<AssetManager.Bundle | null>((resolve) => {
      const option = version ? { version } : null;
      assetManager.loadBundle(url ?? name, option, (err, _bundle) => {
        this._bundleLoadingMap.delete(name);
        if (err || !_bundle) {
          console.warn(`[CCAssets] loadBundle failed: ${name}`, err);
          resolve(null);
          return;
        }
        this._bundleMap.set(name, _bundle);
        resolve(_bundle);
      });
    });

    this._bundleLoadingMap.set(name, promise);
    return promise;
  }

  // ═══════════════════════════════════════════════════════════
  // 内部加载器
  // ═══════════════════════════════════════════════════════════

  private static async _loadSpriteFrame(
    bundleName: string, path: string, formate: SpriteLoadFormate = 'spriteFrame',
  ): Promise<SpriteFrame | null> {
    if (!path || path.trim() === '') return null;

    const bundle = await this._loadBundle(bundleName);
    if (!bundle) return null;

    if (formate === 'spriteFrame') {
      return new Promise<SpriteFrame | null>((resolve) => {
        bundle.load(`${path}/spriteFrame`, SpriteFrame, (err: any, sf: SpriteFrame) => {
          resolve(err ? null : sf);
        });
      });
    }

    if (formate === 'texture') {
      return new Promise<SpriteFrame | null>((resolve) => {
        bundle.load(`${path}/texture`, Texture2D, (err: any, tex: Texture2D) => {
          if (err || !tex) { resolve(null); return; }
          const sf = new SpriteFrame();
          sf.texture = tex;
          resolve(sf);
        });
      });
    }

    return null;
  }

  private static async _loadRemoteSpriteFrame(url: string): Promise<SpriteFrame | null> {
    if (!url || url.trim() === '') return null;

    const cached = this._remoteSpriteFrameCache.get(url);
    if (cached) return cached;

    const loading = this._remoteLoadingMap.get(url);
    if (loading) return loading;

    const promise = new Promise<SpriteFrame | null>((resolve) => {
      assetManager.loadRemote<ImageAsset>(url, (err: any, imageAsset) => {
        this._remoteLoadingMap.delete(url);
        if (err || !imageAsset) {
          resolve(null);
          return;
        }
        const sf = new SpriteFrame();
        const tex = new Texture2D();
        tex.image = imageAsset;
        sf.texture = tex;
        this._remoteSpriteFrameCache.set(url, sf);
        resolve(sf);
      });
    });

    this._remoteLoadingMap.set(url, promise);
    return promise;
  }

  // ═══════════════════════════════════════════════════════════
  // 释放
  // ═══════════════════════════════════════════════════════════

  private static async _releaseWithBundle(bundleName: string, path: string): Promise<void> {
    if (!path || path.trim() === '') return;
    const bundle = await this._loadBundle(bundleName ?? _res_);
    if (!bundle) return;
    bundle.release(path);
  }

  // ═══════════════════════════════════════════════════════════
  // 公开 API
  // ═══════════════════════════════════════════════════════════

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
  static async loadAsset<T extends Asset = Asset>(
    raw: string,
    type?: { new(...args: any[]): T },
  ): Promise<T | null> {
    const parsed = this._parsePath(raw);
    if (!parsed.path) return null;

    if (parsed.isRemote) {
      return new Promise<T | null>((resolve) => {
        assetManager.loadRemote(parsed.path, (err: any, asset: any) => {
          resolve(err ? null : (asset as T ?? null));
        });
      });
    }

    const bundle = await this._loadBundle(parsed.bundle ?? _res_);
    if (!bundle) return null;

    return new Promise<T | null>((resolve) => {
      if (type) {
        bundle.load(parsed.path, type, (err: any, asset: T) => {
          resolve(err ? null : asset);
        });
      } else {
        bundle.load(parsed.path, (err: any, asset: T) => {
          resolve(err ? null : asset);
        });
      }
    });
  }

  /**
   * 获取 SpriteFrame（异步）。
   * @param raw 资源路径，支持本地 / db:// / 远程 URL
   * @param formate 精灵帧格式
   * @example
   *   CCAssets.getSpriteFrame('image/icon');
   *   CCAssets.getSpriteFrame('db://game/image/icon');
   *   CCAssets.getSpriteFrame('https://cdn.example.com/icon.png');
   */
  static async getSpriteFrame(
    raw: string, formate: SpriteLoadFormate = 'spriteFrame',
  ): Promise<SpriteFrame | null> {
    const parsed = this._parsePath(raw);
    if (!parsed.path) return null;
    if (parsed.isRemote) {
      return this._loadRemoteSpriteFrame(parsed.path);
    }
    return this._loadSpriteFrame(parsed.bundle ?? _res_, parsed.path, formate);
  }

  /**
   * 获取预制体。
   * @param raw 预制体路径（不包含后缀）
   */
  static async getPrefab(raw: string): Promise<Prefab | null> {
    return this.loadAsset<Prefab>(raw, Prefab);
  }

  /**
   * 获取 JsonAsset（返回原始资产对象，调用方需自行管理释放）。
   * @param raw JSON 路径（不包含后缀）
   */
  static async getJsonAsset(raw: string): Promise<JsonAsset | null> {
    return this.loadAsset<JsonAsset>(raw, JsonAsset);
  }

  /**
   * 获取 JSON 数据。
   * @param raw JSON 路径（不包含后缀）
   */
  static async getJson<T = any>(raw: string): Promise<T | null> {
    const asset = await this.loadAsset<JsonAsset>(raw, JsonAsset);
    return (asset?.json as T) ?? null;
  }

  /**
   * 获取音频剪辑。
   * @param raw 音频路径（不包含后缀）
   */
  static async getAudioClip(raw: string): Promise<AudioClip | null> {
    return this.loadAsset<AudioClip>(raw, AudioClip);
  }

  /**
   * 获取文本内容。
   * @param raw 文本路径（不包含后缀）
   */
  static async getText(raw: string): Promise<string | null> {
    const asset = await this.loadAsset<TextAsset>(raw, TextAsset);
    return asset?.text ?? null;
  }

  /**
   * 释放本地资源（调用 bundle.release，refCount--）。
   * @param raw 资源路径
   */
  static async releasePath(raw: string): Promise<void> {
    const parsed = this._parsePath(raw);
    if (parsed.isRemote) return;
    return this._releaseWithBundle(parsed.bundle ?? _res_, parsed.path);
  }

  /**
   * 释放远程 SpriteFrame 缓存。
   * @param url 可选：指定 URL 释放单个；不传则释放全部远程缓存。
   */
  static releaseRemote(url?: string): void {
    const releaseOne = (targetUrl: string) => {
      const frame = this._remoteSpriteFrameCache.get(targetUrl);
      if (!frame) return;
      const texture = frame.texture as Texture2D | null;
      this._remoteSpriteFrameCache.delete(targetUrl);
      if (frame.isValid) frame.destroy();
      if (texture && texture.isValid) texture.destroy();
    };

    if (url) {
      releaseOne(url);
      return;
    }

    for (const key of this._remoteSpriteFrameCache.keys()) {
      releaseOne(key);
    }
  }
}
