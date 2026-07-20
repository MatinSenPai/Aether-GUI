fn main() {
    // Embed the Windows application manifest (asInvoker — elevation is
    // requested on demand via the `elevate` command for TUN mode).
    #[cfg(windows)]
    {
        let _ = embed_resource::compile("app.rc", &["app.manifest"]);
    }

    tauri_build::build()
}
