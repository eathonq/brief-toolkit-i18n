# i18n 国际化

> 基于 Cocos Creator 3.8.8 的轻量级国际化模块（文本 + 图片）。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.1.0` |
| Cocos 版本 | `v3.8.8` |

## 简介

i18n 模块用于统一管理语言数据、文本取值和图片路径映射。

核心设计分为四层：
- `I18nManager`：全局单例，运行时核心（加载语言 JSON、扁平化 key、切换语言、事件刷新、格式化）。自举绑定 I18n，无需场景组件激活。
- `I18nSetting`：可选配置组件（默认语言、资源目录、编辑器显示模式）。仅编辑器便利，多场景游戏无需重复挂载。
- `I18nLabel` / `I18nSprite`：组件绑定层（自动把 key 映射到 Label 文本或 SpriteFrame）。
- `I18n` 静态门面 + `pure.ts`：纯 TS 入口，ViewModel 可直接调用，零 Cocos 依赖，永不崩溃。

## 当前目录结构

```shell
├── i18n
│   ├── pure.ts                       # 纯 TS 入口（ViewModel 专用，零 cc 依赖）
│   ├── index.ts                      # Cocos 层入口（组件使用）
│   ├── components
│   │   ├── I18nLabel.ts              # 文本本地化组件（Label/RichText/EditBox）
│   │   ├── I18nSetting.ts            # 多语言配置组件（可选，编辑器便利）
│   │   └── I18nSprite.ts             # 图片本地化组件（Sprite）
│   └── core
│       ├── DefaultI18nManager.ts     # Null Object 实现（未绑定时兜底）
│       ├── I18n.ts                   # i18n 静态门面（bind/unbind + Null Object 兜底）
│       ├── I18nEditorBridge.ts       # 编辑器模式下的图片解析桥接
│       ├── I18nEvent.ts              # 事件类型定义（LANGUAGE_SWITCHED 等）
│       ├── II18nManager.ts           # 管理器接口 + I18nLabelMode 枚举
│       └── I18nManager.ts            # 本地化核心实现（全局单例 + 自举 + EventBus 驱动）
```

## 语言资源规范

默认资源目录为 `resources/i18n`，可在 `I18nSetting.assetPath`（或 `I18nManager.instance.assetPath`）中修改。  
注意：`assetPath` 仅支持在 `EDITOR` 模式下修改。

### 1. 语言 JSON（示例：`resources/i18n/zh.json`）

```json
{
  "meta": {
    "code": "zh",
    "name": "中文",
    "version": "1.0.0"
  },
  "common": {
    "confirm": "确认",
    "time_now": "当前时间：{0}",
    "publish_at": "发布于 {0}"
  },
  "args": {
    "welcome": "欢迎来到{0}!"
  },
  "image": {
    "home": "home"
  }
}
```

说明：
- `meta.code` / `meta.name` 为必填。
- 文本 key 支持点语法，如 `common.confirm`。
- `text()` 占位符使用 `{0}`、`{1}`，支持字符串、数字等类型。
- 图片 key 的值是相对文件名（不带后缀），最终会拼成：`{assetPath}/{language}/{value}`。

### 2. 图片资源目录（示例）

```shell
resources
└── i18n
    ├── zh
    │   └── home.png
    ├── en
    │   └── home.png
    ├── zh.json
    └── en.json
```

## 快速开始

### 1. 场景中挂载 I18nSetting（推荐）
- 将 `I18nSetting` 挂到场景常驻节点。
- 在 `defaultAsset` 指向一个默认语言 JSON（例如 `resources/i18n/zh`）。
- `assetPath` 默认 `i18n`，对应 `resources/i18n`（编辑器模式可改）。
- `I18nManager` 是全局单例运行时核心，不是 Component。

### 2. 文本本地化
- 在含有 `Label` / `RichText` / `EditBox` 的节点挂 `I18nLabel`。
- 设置 `key`（如 `common.confirm`）。
- 需要参数时填写 `args`（如 `Game` → 匹配 `{0}`）。

### 3. 图片本地化
- 在含有 `Sprite` 的节点挂 `I18nSprite`。
- 设置 `key`（如 `image.home`）。

### 4. ViewModel 代码调用（推荐使用 `pure.ts`）

```ts
import { I18n } from "db://brief-toolkit-i18n/i18n/pure";

// 切换语言
await I18n.switch("en");

// 获取简单文本
I18n.text("common.confirm");               // "确定"
I18n.text("args.welcome", ["Game"]);       // "欢迎来到Game!"
```

### 5. 语言回退（Fallback）

当某个 key 在当前语言中缺失时，自动回退到指定语言：

```ts
import { I18n } from "db://brief-toolkit-i18n/i18n/pure";

// 设置回退语言
await I18n.setFallbackLanguage("zh");

// 当前语言缺失 → 回退中文 → key 本身
I18n.text("some.missing.key");  // 返回中文翻译

// 查询 / 清除
I18n.fallbackLanguage;  // "zh"
I18n.clearFallbackLanguage();
```

### 6. 事件监听与切换状态

```ts
import { I18nEventType } from "db://brief-toolkit-i18n/i18n/pure";
import { EventBus } from "db://brief-toolkit-i18n/common/pure";

// UI 响应：用事件驱动，不要轮询属性
EventBus.on(I18nEventType.LANGUAGE_BEFORE_SWITCH, ({ from, to }) => {
  showLoading();
  console.log(`切换中: ${from} → ${to}`);
});
const token = EventBus.on(I18nEventType.LANGUAGE_SWITCHED, ({ language }) => {
  hideLoading();
  console.log(`切换完成: ${language}`);
});
EventBus.on(I18nEventType.LANGUAGE_SWITCH_ERROR, ({ from, to, error }) => {
  hideLoading();
  console.error(`切换失败: ${from} → ${to}`, error);
});

// 取消订阅
EventBus.offByToken(token);
```

### 7. 通过 I18nSetting 切换语言（编辑器事件绑定）

```
编辑器方式：
  按钮 ClickEvents → 添加目标 → 选按钮所在组件
  → CustomEventData 填语言代码 → 绑定 `I18nSetting.onLanguageSwitch`
```

### 8. 调试模式（显示 key 而非翻译文本）

```ts
import { I18nManager, I18nLabelMode } from "db://brief-toolkit-i18n/i18n";

I18nManager.instance.labelModel = I18nLabelMode.PATH;  // 显示 key
I18nManager.instance.labelModel = I18nLabelMode.DATA;  // 恢复翻译
```

## 运行机制说明

### 语言加载流程
1. `I18nManager.instance` 首次访问 → 构造函数自举 `__i18nBind(this)`
2. `I18nSetting.onLoad()`（可选）或代码直接设置 `languageAsset`
3. `I18nManager` 读取 JSON → 扁平化为 `Map<string, string>` → O(1) 查找
4. 发射 `LANGUAGE_SWITCHED` 事件 → 所有订阅组件自动刷新

### 事件驱动 vs 全场景遍历
```
切语言 → EventBus.emit LANGUAGE_SWITCHED → 已订阅组件直接响应
                                            (O(m)，m = 实际注册的组件数)
不再遍历场景全部节点（O(n)）。
底层使用 common/EventBus 统一事件总线，与 ViewModel 的 @event 共享同一命名空间。
```

### 纯 TS 隔离（pure.ts）
```
pure.ts (零 cc 依赖)
  └→ I18n (静态门面) → bind/unbind → II18nManager (接口)
        ├→ DefaultI18nManager (Null Object，未绑定时兜底)
        └→ I18nManager (全局单例，构造函数自举注入)

事件通信统一使用 common/EventBus：
  EventBus ← I18nManager (emit 事件)
  EventBus → I18nLabel / I18nSprite / ViewModel @event (订阅事件)
```

ViewModel 从 `pure.ts` 导入，单元测试 / SSR 环境下也能正常运行。

### Null Object 模式
- `I18n.text("key")`：未绑定 → 返回 key（不崩溃）
- `I18n.switch("en")`：未绑定 → 静默成功（不 reject）

### 错误恢复
`switch()` 加载失败时自动回滚到旧语言，不会因网络异常导致当前语言丢失。

## 注意事项
- 语言 JSON 的 `meta` 节点必须合法（至少包含 `code` 和 `name`），否则会报错并无法切换。
- `I18nLabel` 仅在节点上存在 `Label` / `RichText` / `EditBox` 时生效。
- `I18nSprite` 仅在节点上存在 `Sprite` 时生效。
- `I18nLabel.args` 在编辑器属性面板中仅支持字符串数组。
- 纯编辑器模式（`EDITOR`）下，`I18nSprite` 没有加载图片（除非使用了编辑器桥接）。

## 编辑器桥接（可选）

如果你希望在纯编辑器模式下也实时看到 `I18nSprite` 切图：

说明：
- 该通道默认未注册，不影响运行时逻辑。
- 建议仅在 Editor Extension 中使用，避免把编辑器 API 混入运行时代码。

本仓库已提供一个最小扩展：
- `extensions/brief-toolkit-i18n-editor`

启用步骤：
1. 打开 Cocos Creator。
2. 进入 `扩展 -> 扩展管理器 -> 项目`。
3. 启用 `brief-toolkit-i18n-editor`。
4. 刷新扩展（必要时重启编辑器）。

## 导出参考

### pure.ts（ViewModel 入口，零 Cocos 依赖）
| 导出 | 来源 |
|------|------|
| `I18n` | 静态门面（language / text / switch / fallbackLanguage 等） |
| `DefaultI18nManager` | Null Object（测试/SSR 场景） |
| `II18nManager`（type） | 管理器接口 |
| `I18nLabelMode` | 文本显示模式枚举 |
| `I18nEventType` | 事件类型枚举（搭配 common/EventBus 使用） |
| `I18nLanguage...Event`（type） | 事件载荷类型 |

### index.ts（Cocos 层入口）
| 导出 | 别名 |
|------|------|
| `I18nManager` | - |
| `I18nSetting` | - |
| `I18nLabel` | - |
| `I18nSprite` | - |
| `I18n` | - |
| `I18nLabelMode` | - |
| `I18nEventType` | - |
| `LanguageMeta`（type） | - |

## API 速查

```ts
import { I18n } from "db://brief-toolkit-i18n/i18n/pure";
import { EventBus } from "db://brief-toolkit-i18n/common/pure";

// ── 属性 ──
I18n.language              // string       当前语言代码
I18n.fallbackLanguage      // string|null  回退语言代码

// ── 文本 ──
I18n.text(key)                         // 获取简单文本
I18n.text(key, args: any[])            // 获取带占位符文本

// ── 切换 ──
await I18n.switch(lang)                 // 切换语言
await I18n.setFallbackLanguage(lang)    // 设置回退语言
I18n.clearFallbackLanguage()            // 清除回退语言

// ── 事件（统一使用 common/EventBus）──
EventBus.on(I18nEventType.LANGUAGE_SWITCHED, cb)   // 订阅
EventBus.offByToken(token)                          // 取消订阅
```

## 📄 协议

MIT License
