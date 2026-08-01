"use strict";

module.exports = {
  // 包 & 菜单
  title: "brief-toolkit-i18n",
  description: "Brief Toolkit I18n 插件",
  i18n_panel_title: "I18n 面板",
  open_panel: "默认面板",
  open_i18n_panel: "打开 I18n 面板",
  send_to_panel: "发送消息给面板",
  profile_i18n_panel_state: "多语言面板配置",

  // 区域标题
  section_resource_dir: "多语言资源目录设置：",
  section_locale_list: "多语言列表：",

  // 输入框占位符
  input_resource_dir_placeholder: "请配置多语言目录",
  input_new_dir_placeholder: "请输入目录名称，例如 zh",

  // 按钮
  btn_add: "添加",
  btn_transfer: "转移",
  btn_add_locale: "新增",

  // 表格表头
  table_header_code: "目录",
  table_header_is_template: "是否模板",
  table_header_set_template: "设置模板",
  table_header_sync: "同步",
  table_header_open: "打开",
  table_header_delete: "删除",

  // 表格单元格内容
  template_yes: "是",
  template_no: "否",
  btn_set_template: "设为模板",
  btn_current_template: "当前模板",
  btn_sync: "同步",
  btn_open: "打开",
  btn_delete: "删除",
  btn_confirm_delete: "确认删除",
  btn_confirm_sync: "确认同步",
  empty_tip: "暂无多语言文件，请在下方新增。",

  // 同步对话框
  sync_confirm_title: "同步确认",
  sync_confirm_message: "将以 {0} 为基准同步其他 {1} 份多语言文件。非 meta 节点会删除多余项并补齐缺失项，是否继续？",
  sync_confirm_cancel: "取消",
  sync_confirm_ok: "同步",
  sync_no_targets: "无可同步的目标多语言文件。",

  // 日志 / 警告消息
  log_schema_created: "已创建 schema 文件: {0}",
  log_schema_create_failed: "创建 schema 文件失败: {0}",
  log_dir_transferred: "已将目录从 {0} 转移为 {1}",
  log_dir_added: "已添加目录: {0}",
  log_schema_verified: "schema 校验通过: {0}",
  log_schema_missing: "schema 文件缺失: {0}",
  log_enter_resource_dir: "请先输入多语言目录。",
  log_set_dir_failed: "设置目录失败:",
  log_configure_dir_first: "请先配置多语言资源目录。",
  log_locale_exists: "多语言文件已存在: {0}",
  log_add_locale_failed: "新增多语言文件失败:",
  log_sync_complete: "同步完成，基准文件: {0}，更新文件数: {1}。",
  log_sync_failed: "同步失败: {0}",
  log_sync_dialog_failed: "同步确认弹窗调用失败:",
  log_delete_dialog_failed: "删除确认弹窗调用失败:",
  log_cannot_open: "无法打开文件: {0}",
  log_open_asset_failed: "asset-db 打开失败，回退到 shell:",
  log_electron_unavailable: "Electron shell 不可用:",
  log_profile_load_failed: "加载 profile 状态失败:",
  log_profile_save_failed: "保存 profile 状态失败:",
  log_asset_db_query_failed: "asset-db 查询失败，回退到文件系统检查:",
  log_asset_db_refresh_failed: "asset-db 刷新失败:",

  // 日志面板
  section_log_title: "操作日志",
  btn_clear_log: "清空",
  log_empty: "暂无操作记录。",

  // 操作日志消息
  op_schema_created: "已创建 schema 文件",
  op_dir_added: "已添加目录: {0}",
  op_dir_transferred: "已转移目录: {0} → {1}",
  op_schema_verified: "schema 校验通过: {0}",
  op_locale_added: "已新增语言: {0}",
  op_locale_exists: "语言文件已存在: {0}",
  op_sync_complete: "同步完成 — 基准: {0}, 更新文件数: {1}",
  op_sync_failed: "同步失败 {0}: {1}",
  op_delete_complete: "已删除: {0}",
  op_template_set: "模板已设置为: {0}",
  op_open_failed: "打开失败: {0}",
  op_schema_missing: "schema 文件缺失: {0}",
  op_set_dir_failed: "设置目录失败: {0}",
  op_add_locale_failed: "新增语言失败: {0}",
};
