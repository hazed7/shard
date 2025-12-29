mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_profiles_cmd,
            commands::load_profile_cmd,
            commands::create_profile_cmd,
            commands::clone_profile_cmd,
            commands::diff_profiles_cmd,
            commands::add_mod_cmd,
            commands::add_resourcepack_cmd,
            commands::add_shaderpack_cmd,
            commands::remove_mod_cmd,
            commands::remove_resourcepack_cmd,
            commands::remove_shaderpack_cmd,
            commands::list_accounts_cmd,
            commands::set_active_account_cmd,
            commands::remove_account_cmd,
            commands::get_config_cmd,
            commands::save_config_cmd,
            commands::request_device_code_cmd,
            commands::finish_device_code_flow_cmd,
            commands::prepare_profile_cmd,
            commands::launch_profile_cmd,
            commands::instance_path_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
