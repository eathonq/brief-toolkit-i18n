/**
 * I18nSetting.ts - 多语言配置组件（可选）
 * @description 可选的编辑器便利组件，用于在场景节点上配置默认语言和资源路径。
 *              运行时也可以通过代码直接操作 I18nManager.instance。
 * @important I18nManager 已是全局单例且自举绑定 I18n，无需依赖此组件即可工作。
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-03-15
 * @modified 2026-06-10
 */

import { _decorator, Component, Enum, JsonAsset } from 'cc';
import { EDITOR } from 'cc/env';
import { I18nManager } from '../core/I18nManager';
import { I18nLabelMode } from '../core/II18nManager';
const { ccclass, help, property, executeInEditMode, menu } = _decorator;

const I18N_ASSET_PATH = "i18n";

/**
 * [i18n-I18nSetting]
 * i18n 多语言配置组件（可选）
 * EDITOR 模式下，修改 defaultAsset 和 assetPath 会直接影响 I18nManager 的对应属性。
 */
@ccclass('i18n.I18nSetting')
@help('https://vangagh.gitbook.io/brief-toolkit/i18n/i18nsetting')
@executeInEditMode
@menu('I18n/I18nSetting')
export class I18nSetting extends Component {
  // 默认语言资源
  @property(JsonAsset)
  private _defaultAsset: JsonAsset = null!;
  @property({
    type: JsonAsset,
    tooltip: "默认语言配置文件",
  })
  get defaultAsset() {
    return this._defaultAsset;
  }
  set defaultAsset(value) {
    this._defaultAsset = value;
    if (EDITOR) {
      I18nManager.instance.languageAsset = value;
    }
  }

  //#region LabelModel
  @property
  private _labelModel: I18nLabelMode = I18nLabelMode.DATA;
  @property({
    type: Enum(I18nLabelMode),
    tooltip: "本地化文本显示模式（仅编辑状态有效）",
  })
  get labelModel() {
    return this._labelModel;
  }
  private set labelModel(value) {
    this._labelModel = value;
    I18nManager.instance.labelModel = this._labelModel;
  }
  //#endregion

  @property
  private _assetPath = I18N_ASSET_PATH;
  @property({
    tooltip: "多语言 JSON 文件存放路径（仅用于加载语言配置文件，不影响图片路径）",
  })
  get assetPath() {
    return this._assetPath;
  }
  set assetPath(value: string) {
    if (EDITOR) {
      I18nManager.instance.assetPath = value;
    }
  }

  protected onLoad(): void {
    if (this._defaultAsset) {
      I18nManager.instance.languageAsset = this._defaultAsset;
    } else {
      console.warn("I18nSetting: defaultAsset is not set.");
    }
  }

  /**
   * 编辑器绑定事件：切换语言
   * @param object 事件对象
   * @param language 自定义多语言
    */
  onLanguageSwitch(object: any, language: string) {
    I18nManager.instance.switch(language);
  }
}
