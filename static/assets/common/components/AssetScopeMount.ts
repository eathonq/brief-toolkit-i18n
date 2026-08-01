/**
 * AssetScopeMount.ts - 资源作用域挂载组件
 * @description 拖到场景根节点，自动管理场景资源生命周期。
 *
 * ## 用法
 *   1. 场景根节点挂载本组件
 *   2. 填写 scopeName（默认用场景名）
 *   3. 场景 onLoad  → AssetScopeManager.push(scopeName)
 *      场景 onDestroy → AssetScopeManager.pop() → 自动 releaseAll
 *
 *   —— 零代码接入，不需要在场景脚本中手动管理 scope。
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-19
 */

import { _decorator, Component } from 'cc';
import { AssetScopeManager } from '../core/AssetScopeManager';

const { ccclass, property, menu } = _decorator;

/** 资源作用域挂载组件 */
@ccclass('common.AssetScopeMount')
// @menu('BriefToolkit/Common/AssetScopeMount')
export class AssetScopeMount extends Component {
  @property({
    tooltip: '作用域名（默认用场景名，栈式管理：建议 "battle" / "map" 等）',
  })
  private scopeName: string = '';

  protected onLoad(): void {
    const name = this.scopeName || this.node.scene?.name || 'scene';
    AssetScopeManager.push(name);
  }

  protected onDestroy(): void {
    const name = this.scopeName || this.node.scene?.name || 'scene';
    AssetScopeManager.pop(name);
  }
}
