# brief-toolkit-i18n

> 基于 Cocos Creator 3.8.8 的轻量级国际化插件（文本 + 图片）。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.0.0` |
| Cocos 版本 | `>=3.8.8` |
| 作者 | [vangagh@live.cn](mailto:vangagh@live.cn) |
| 协议 | [MIT License](LICENSE.md) |

## 简介

`brief-toolkit-i18n` 是 Cocos Creator 编辑器插件，为项目提供开箱即用的多语言支持，覆盖 `Label` / `RichText` / `EditBox` 文本本地化与 `Sprite` 图片本地化。

核心依托 EventBus 驱动，切换语言时仅通知已注册组件（O(m)），不会全场景遍历（O(n)）。同时提供纯 TS 入口 `pure.ts`，ViewModel 可直接调用，零 Cocos 依赖，兼容单元测试与 SSR 场景。

## 模块概览

| 目录 | 说明 |
| --- | --- |
| [static/assets/i18n/](static/assets/i18n/) | i18n 静态模块（组件 + 核心管理器 + 纯 TS 入口） |
| [static/assets/common/](static/assets/common/) | 通用工具（EventBus 等） |
| [dist/](dist/) | 编辑器扩展构建产物 |
| [i18n/](i18n/) | 插件面板相关资源 |

## 快速开始

详细文档请阅读 [static/assets/i18n/README.md](static/assets/i18n/README.md)。

### 安装

1. 将插件放入 Cocos Creator 项目的 `extensions/` 目录。
2. 在编辑器中启用扩展：`扩展 → 扩展管理器 → 项目`。

### 场景中使用

1. 在常驻节点挂载 `I18nSetting` 组件，配置默认语言与资源路径。
2. 在 `Label` / `RichText` / `EditBox` 节点挂载 `I18nLabel`，填写翻译 key。
3. 在 `Sprite` 节点挂载 `I18nSprite`，填写图片 key。

### ViewModel 中调用

```ts
import { I18n, DateFormatter } from "db://brief-toolkit-i18n/i18n/pure";

// 切换语言
await I18n.switch("en");

// 获取文本
I18n.text("common.confirm");              // "确定"
I18n.text("args.welcome", ["Game"]);      // "欢迎来到Game!"

// 日期格式化
I18n.format("time_now", [new Date()]);
DateFormatter.format(new Date(), "MM/dd HH:mm");
```

## 编辑器扩展

插件提供以下编辑器功能：

- **I18n 面板**：通过菜单 `brief-toolkit-i18n → 打开 I18n 面板` 进入，管理多语言配置。
- **编辑器桥接**（可选）：启用 `brief-toolkit-i18n-editor` 扩展后，可在编辑器模式下实时预览 `I18nSprite` 切图效果。

## 协议

本项目基于 [MIT License](LICENSE.md) 发布。
