fn main() {
    // Embed the Windows application manifest so the exe requests admin
    // elevation (required for sing-box TUN mode).
    #[cfg(windows)]
    {
        let _ = embed_resource::compile("app.rc", &["app.manifest"]);
    }

    tauri_build::build()
}
