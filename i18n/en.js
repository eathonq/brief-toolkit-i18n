"use strict";
module.exports = {
  // Package & menu
  title: "brief-toolkit-i18n",
  description: "Brief Toolkit I18N Plugin",
  i18n_panel_title: "i18n Panel",
  open_panel: "Default Panel",
  open_i18n_panel: "Open i18n Panel",
  send_to_panel: "Send message to Default Panel",
  profile_i18n_panel_state: "i18n panel settings",

  // Section titles
  section_resource_dir: "i18n Resource Directory:",
  section_locale_list: "Locale List:",

  // Input placeholders
  input_resource_dir_placeholder: "Configure i18n directory",
  input_new_dir_placeholder: "Enter locale code, e.g. en",

  // Buttons
  btn_add: "Add",
  btn_transfer: "Transfer",
  btn_add_locale: "Add Locale",

  // Table headers
  table_header_code: "Code",
  table_header_is_template: "Is Template",
  table_header_set_template: "Set Template",
  table_header_sync: "Sync",
  table_header_open: "Open",
  table_header_delete: "Delete",

  // Table cell content
  template_yes: "Yes",
  template_no: "No",
  btn_set_template: "Set as Template",
  btn_current_template: "Current Template",
  btn_sync: "Sync",
  btn_open: "Open",
  btn_delete: "Delete",
  btn_confirm_delete: "Confirm Delete",
  btn_confirm_sync: "Confirm Sync",
  empty_tip: "No locale files. Add one below.",

  // Sync dialog
  sync_confirm_title: "Sync Confirmation",
  sync_confirm_message: 'Sync from "{0}" to {1} other locale file(s). Non-meta keys will be added or removed to match the source. Continue?',
  sync_confirm_cancel: "Cancel",
  sync_confirm_ok: "Sync",
  sync_no_targets: "No other locale files to sync to.",

  // Log / warn messages
  log_schema_created: "Schema file created: {0}",
  log_schema_create_failed: "Failed to create schema file: {0}",
  log_dir_transferred: "Directory transferred from {0} to {1}",
  log_dir_added: "Directory added: {0}",
  log_schema_verified: "Schema verified: {0}",
  log_schema_missing: "Schema file missing: {0}",
  log_enter_resource_dir: "Please enter the i18n resource directory first.",
  log_set_dir_failed: "Failed to set directory:",
  log_configure_dir_first: "Please configure the i18n resource directory first.",
  log_locale_exists: "Locale file already exists: {0}",
  log_add_locale_failed: "Failed to add locale file:",
  log_sync_complete: "Sync complete. Source: {0}, files updated: {1}.",
  log_sync_failed: "Sync failed: {0}",
  log_sync_dialog_failed: "Sync confirmation dialog failed:",
  log_delete_dialog_failed: "Delete confirmation dialog failed:",
  log_cannot_open: "Cannot open file: {0}",
  log_open_asset_failed: "asset-db open failed, fallback to shell:",
  log_electron_unavailable: "Electron shell unavailable:",
  log_profile_load_failed: "Failed to load profile state:",
  log_profile_save_failed: "Failed to save profile state:",
  log_asset_db_query_failed: "asset-db query failed, fallback to fs exists:",
  log_asset_db_refresh_failed: "asset-db refresh failed:",

  // Log panel
  section_log_title: "Operation Log",
  btn_clear_log: "Clear",
  log_empty: "No operations yet.",

  // Operation log messages
  op_schema_created: "Schema file created",
  op_dir_added: "Directory added: {0}",
  op_dir_transferred: "Directory transferred: {0} → {1}",
  op_schema_verified: "Schema verified: {0}",
  op_locale_added: "Locale added: {0}",
  op_locale_exists: "Locale already exists: {0}",
  op_sync_complete: "Sync complete — source: {0}, files updated: {1}",
  op_sync_failed: "Sync failed for {0}: {1}",
  op_delete_complete: "Deleted: {0}",
  op_template_set: "Template set to: {0}",
  op_open_failed: "Failed to open: {0}",
  op_schema_missing: "Schema file missing: {0}",
  op_set_dir_failed: "Failed to set directory: {0}",
  op_add_locale_failed: "Failed to add locale: {0}",
};
