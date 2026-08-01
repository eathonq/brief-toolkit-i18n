# Common — 公共资源 & 事件总线模块

> `brief-toolkit` 的统一资源加载与生命周期管理层 + 跨模块事件通信基础设施。提供 `CCAssets` 底层加载器 + `AssetScope` 作用域追踪 + `AssetScopeManager` 场景级自动管理 + `AssetScopeMount` 零代码接入组件，以及 `EventBus` 全局发布/订阅事件总线。

---

## 架构层次

```
组件层    CCElement   I18nSprite   SkinSprite   AudioManager   ...
              │            │            │            │
              ▼            ▼            ▼            ▼
管理层    AssetScopeManager (scene-scoped)          AssetScope (module-scoped, 自管)
              │            │                          │
              ▼            ▼                          ▼
作用域层  AssetScope (场景 push/pop 自动创建)    AssetScope (I18nManager / AudioManager 自管)
              │                                      │
              ▼                                      ▼
加载层    CCAssets (纯静态加载器, 路径解析 + bundle 管理 + 远程缓存)
              │
              ▼
引擎层    Cocos assetManager / bundle
```

---

## 模块组成

### CCAssets — 底层资源加载器

纯静态方法类，负责路径解析、bundle 管理、远程缓存。**不做 UI 操作，不做生命周期追踪。**

| 方法 | 返回 | 说明 |
| :--- | :--- | :--- |
| `getSpriteFrame(path, formate?)` | `SpriteFrame \| null` | 加载精灵帧（本地 / `db://` / 远程 URL） |
| `getPrefab(path)` | `Prefab \| null` | 加载预制体 |
| `getJsonAsset(path, bundleName?)` | `JsonAsset \| null` | 加载 JSON 资产对象 |
| `getJson<T>(path)` | `T \| null` | 加载并解析 JSON 数据（不追踪资产） |
| `getAudioClip(path)` | `AudioClip \| null` | 加载音频剪辑 |
| `getText(path)` | `string \| null` | 加载文本内容 |
| `releasePath(path)` | `Promise<void>` | 释放本地资源 (bundle.release) |
| `releaseRemote(url?)` | `void` | 释放远程 SpriteFrame 缓存 |

**路径语法**：

| 格式 | 示例 | 说明 |
| :--- | :--- | :--- |
| 主包相对路径 | `'image/icon'` | `resources/image/icon` |
| `db://` 协议 | `'db://game/image/icon'` | 指定 bundle 名 |
| 远程 URL | `'https://cdn.example.com/icon.png'` | 仅 SpriteFrame |

> **注意**：外部组件应通过 `AssetScope` 或 `AssetScopeManager` 加载资源以自动追踪生命周期，而非直接调用 `CCAssets`。

### AssetScope — 资源作用域

按实例追踪资源路径，通过 `releaseAll()` 统一释放。每个场景/模块创建独立的实例。

| 方法 | 说明 |
| :--- | :--- |
| `getSpriteFrame(path)` | 加载 + 自动追踪路径 |
| `getJsonAsset(path, bundleName?)` | 加载 JSON 资产 + 自动追踪 |
| `getPrefab(path)` | 加载预制体 + 自动追踪 |
| `getAudioClip(path)` | 加载音频 + 自动追踪 |
| `track(path)` | 手动追踪外部加载的路径 |
| `releaseAll()` | 统一释放所有追踪资源 (bundle.release) |
| `debug()` | 返回 `{ name, pathCount, paths }` 调试快照 |

**生命周期示例**：

```ts
// 模块级自管 (I18nManager / AudioManager 模式)
const scope = new AssetScope('i18n_zh-CN');
const json = await scope.getJsonAsset('i18n/zh-CN');
const sf = await scope.getSpriteFrame('db://game/textures/i18n/logo');
// 切语言时
scope.releaseAll(); // JSON + 图片统一释放
```

### AssetScopeManager — 场景级资源管理器

全局单例，管理 `AssetScope` 栈。场景组件通过它加载资源，不感知当前 scope。

| 方法 | 说明 |
| :--- | :--- |
| `getSpriteFrame(path)` | 加载 + 追踪到当前 scope |
| `getJsonAsset(path, bundleName?)` | 加载 JSON 资产 + 追踪 |
| `getPrefab(path)` | 加载预制体 + 追踪 |
| `getAudioClip(path)` | 加载音频 + 追踪 |
| `setNodeSprite(target, path)` | 加载 SpriteFrame + 应用到节点（含请求去抖） |
| `push(name)` / `pop(expectedName?)` | 场景生命周期管理 |
| `current` | 获取当前活跃 scope |
| `stackDepth` / `debug()` | 调试信息 |

**去抖机制**：`setNodeSprite` 内置 `WeakMap` + `requestId` 去抖，保证同一 target 只有最新的 path 请求生效。适合 MVVM 绑定等高频更新场景。

### AssetScopeMount — 场景挂载组件

拖到场景根节点，零代码接入：

1. 场景 `onLoad` → `AssetScopeManager.push(sceneName)`
2. 场景 `onDestroy` → `AssetScopeManager.pop()` → 自动 `releaseAll()`

`scopeName` 属性可自定义（默认用场景名）。

---

### EventBus — 统一事件总线

纯 TS、零依赖的全局发布/订阅，是 `brief-toolkit` 跨模块事件通信的统一基础设施。

| 方法 | 说明 |
| :--- | :--- |
| `EventBus.emit(name, payload?)` | 发送事件 |
| `EventBus.on(name, callback)` | 订阅事件，返回 `SubscriptionToken` |
| `EventBus.once(name, callback)` | 一次性订阅 |
| `EventBus.off(name, callback)` | 取消订阅 |
| `EventBus.offByToken(token)` | 通过令牌取消订阅 |
| `EventBus.clear(name?)` | 清空指定事件或全部事件 |
| `EventBus.subscriberCount(name)` | 查询某事件的订阅者数量 |

**使用示例**：

```ts
import { EventBus } from 'db://brief-toolkit-i18n/common/pure';

// 订阅
const token = EventBus.on<{ score: number }>('score-changed', (payload) => {
  console.log(`Score: ${payload.score}`);
});

// 发送
EventBus.emit('score-changed', { score: 100 });

// 取消
EventBus.offByToken(token);
```

**事件命名建议**：使用 `module:action` 格式避免冲突 — `inventory:item-acquired`、`player:level-up`。

**各模块接入方式**：

| 模块 | 使用方式 |
| :--- | :--- |
| **mvvm** | ViewModel 通过 `this.emit()` + `@event` 声明式收发（框架自动管理生命周期） |
| **i18n** | `I18nManager` 内部 emit；订阅统一用 `EventBus.on(I18nEventType.XXX, cb)` |
| **uim** | 保持 Cocos `Node.emit/on`（视图级事件）；跨模块通信可用 EventBus |
| **guide** | 保持回调注入（任务级事件）；跨模块通信可用 EventBus |
| **外部模块** | `EventBus.emit/on/off` 直接调用 |

> **EventBus 是 brief-toolkit 插件对外公开的唯一事件 API。** 所有模块（mvvm/i18n/uim/guide）及外部代码统一通过 `EventBus` 收发事件。ViewModel 内部可用 `this.emit()` + `@event` 声明式语法糖（框架层自动调用 EventBus）。单个回调异常不影响其他订阅者。


---

## 使用模式

### 模式 1：场景级自动管理

```ts
// 1. 场景根节点挂 AssetScopeMount 组件 (scopeName = "battle")

// 2. 场景组件中加载资源 — 自动追踪到当前 scene scope
const sf = await AssetScopeManager.getSpriteFrame('db://game/textures/char/hero');
// 3. 场景销毁 → pop() → releaseAll() 自动释放
```

### 模式 2：模块级自管 (I18nManager / AudioManager)

```ts
class MyGlobalManager {
  private _scope = new AssetScope('my_module');

  async loadData(path: string) {
    return this._scope.getJsonAsset(path); // 自动追踪
  }

  destroy() {
    this._scope.releaseAll(); // 统一释放
  }
}
```

### 模式 3：混合使用

场景组件通过 `AssetScopeManager` 加载场景资源（自动随场景释放），全局单例（I18nManager、AudioManager）自管 `AssetScope` 实例（跨场景存活，手动控制释放时机）。

---

## 设计原则

| 原则 | 实践 |
| :--- | :--- |
| **类型无关** | `_paths: Set<string>` 统一追踪，`releaseAll()` 按路径释放，不关心资源类型 |
| **ref-count 安全** | 依赖 Cocos AssetManager 自带 ref-count，跨 Scope 共享资源正确协作 |
| **层级清晰** | CCAssets (加载) → AssetScope (追踪) → AssetScopeManager (管理) → AssetScopeMount (接入) |
| **去抖内置** | `setNodeSprite` 在 Manager 层独立去抖，CCAssets 保持纯函数无状态 |
| **统一事件** | EventBus 提供跨模块 pub/sub，ViewModel 声明式 + 外部模块直接调用共享同一命名空间 |

---

## 依赖

- `cc` (SpriteFrame, JsonAsset, Prefab, AudioClip, Node, Sprite, AssetManager, ...)
- 本模块内部：`CCAssets` ← `AssetScope` ← `AssetScopeManager` ← `AssetScopeMount`
- 纯 TS 层：`EventBus` 零 `'cc'` 依赖，可安全用于单元测试和 Node.js 环境
