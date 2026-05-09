use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

            let app_submenu = SubmenuBuilder::new(handle, "Sferic")
                .item(&PredefinedMenuItem::about(handle, Some("About Sferic"), None)?)
                .separator()
                .item(&PredefinedMenuItem::services(handle, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(handle, None)?)
                .item(&PredefinedMenuItem::hide_others(handle, None)?)
                .item(&PredefinedMenuItem::show_all(handle, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(handle, None)?)
                .build()?;

            let file = SubmenuBuilder::new(handle, "File")
                .item(
                    &MenuItemBuilder::with_id("open_audio", "Open audio…")
                        .accelerator("CmdOrCtrl+I")
                        .build(handle)?,
                )
                .item(
                    &MenuItemBuilder::with_id("open_project", "Open project…")
                        .accelerator("CmdOrCtrl+O")
                        .build(handle)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::with_id("save", "Save")
                        .accelerator("CmdOrCtrl+S")
                        .build(handle)?,
                )
                .item(
                    &MenuItemBuilder::with_id("save_as", "Save as…")
                        .accelerator("CmdOrCtrl+Shift+S")
                        .build(handle)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::with_id("render", "Render…")
                        .accelerator("CmdOrCtrl+R")
                        .build(handle)?,
                )
                .build()?;

            let edit = SubmenuBuilder::new(handle, "Edit")
                .item(
                    &MenuItemBuilder::with_id("undo", "Undo")
                        .accelerator("CmdOrCtrl+Z")
                        .build(handle)?,
                )
                .item(
                    &MenuItemBuilder::with_id("redo", "Redo")
                        .accelerator("CmdOrCtrl+Shift+Z")
                        .build(handle)?,
                )
                .separator()
                .item(&PredefinedMenuItem::cut(handle, None)?)
                .item(&PredefinedMenuItem::copy(handle, None)?)
                .item(&PredefinedMenuItem::paste(handle, None)?)
                .item(&PredefinedMenuItem::select_all(handle, None)?)
                .separator()
                .item(
                    &MenuItemBuilder::with_id("delete_kf", "Delete keyframe")
                        .accelerator("Delete")
                        .build(handle)?,
                )
                .item(
                    &MenuItemBuilder::with_id("deselect", "Deselect")
                        .accelerator("Escape")
                        .build(handle)?,
                )
                .build()?;

            let project_menu = SubmenuBuilder::new(handle, "Project")
                .item(
                    &MenuItemBuilder::with_id("insert_kf", "Insert keyframe")
                        .accelerator("CmdOrCtrl+K")
                        .build(handle)?,
                )
                .build()?;

            let view = SubmenuBuilder::new(handle, "View")
                .item(
                    &MenuItemBuilder::with_id("toggle_monitoring", "Toggle BINAURAL / STEREO")
                        .accelerator("CmdOrCtrl+M")
                        .build(handle)?,
                )
                .separator()
                .item(&PredefinedMenuItem::fullscreen(handle, None)?)
                .build()?;

            let help = SubmenuBuilder::new(handle, "Help")
                .item(
                    &MenuItemBuilder::with_id("shortcuts", "Keyboard shortcuts")
                        .build(handle)?,
                )
                .build()?;

            let mut menu_builder = MenuBuilder::new(handle);
            #[cfg(target_os = "macos")]
            {
                menu_builder = menu_builder.item(&app_submenu);
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = &app_submenu;
            }
            let menu = menu_builder
                .item(&file)
                .item(&edit)
                .item(&project_menu)
                .item(&view)
                .item(&help)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app_handle, event| {
                let id = event.id().0.as_str();
                let _ = app_handle.emit("menu", id);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
