use crate::error::AetherError;
use std::env::consts::{ARCH, OS};
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::Path;

const AETHER_VERSION: &str = "v1.0.1";
const REPO: &str = "CluvexStudio/Aether";

fn get_asset_name() -> Result<&'static str, AetherError> {
    match (OS, ARCH) {
        ("windows", "x86_64") => Ok("aether-windows-x86_64.zip"),
        ("linux", "x86_64") => Ok("aether-linux-x86_64.tar.gz"),
        ("linux", "aarch64") => Ok("aether-linux-arm64.tar.gz"),
        ("macos", "x86_64") => Ok("aether-macos-x86_64.tar.gz"),
        ("macos", "aarch64") => Ok("aether-macos-arm64.tar.gz"),
        _ => Err(AetherError::Internal(format!("Unsupported platform: {}-{}", OS, ARCH))),
    }
}

pub fn fetch_and_install(dest_dir: &Path, expected_binary: &Path) -> Result<(), AetherError> {
    let asset = get_asset_name()?;
    let url = format!("https://github.com/{}/releases/download/{}/{}", REPO, AETHER_VERSION, asset);

    // Ensure the destination directory exists
    std::fs::create_dir_all(dest_dir).map_err(|e| AetherError::Internal(e.to_string()))?;

    // Download the archive
    let response = ureq::get(&url)
        .call()
        .map_err(|e| AetherError::Internal(format!("Failed to download {}: {}", asset, e)))?;

    let mut buf = Vec::new();
    response.into_reader().read_to_end(&mut buf)
        .map_err(|e| AetherError::Internal(format!("Failed to read response: {}", e)))?;

    // Extract
    if asset.ends_with(".zip") {
        extract_zip(&buf, dest_dir, expected_binary)?;
    } else if asset.ends_with(".tar.gz") {
        extract_tar_gz(&buf, dest_dir, expected_binary)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if expected_binary.exists() {
                if let Ok(mut perms) = std::fs::metadata(expected_binary).map(|m| m.permissions()) {
                    perms.set_mode(0o755);
                    let _ = std::fs::set_permissions(expected_binary, perms);
                }
            }
        }
    } else {
        return Err(AetherError::Internal("Unknown archive format".into()));
    }

    if !expected_binary.exists() {
        return Err(AetherError::Internal("Binary not found after extraction".into()));
    }

    Ok(())
}

fn extract_zip(buf: &[u8], _dest_dir: &Path, expected_binary: &Path) -> Result<(), AetherError> {
    let reader = Cursor::new(buf);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| AetherError::Internal(format!("Failed to open zip: {}", e)))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        // Aether zip usually contains just the binary. Check name or just extract all.
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };
        
        // Since we know we need `expected_binary`, let's just write whatever is inside 
        // to `expected_binary` if it's the executable.
        if outpath.to_string_lossy().contains("aether") {
            let mut outfile = File::create(expected_binary)
                .map_err(|e| AetherError::Internal(e.to_string()))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| AetherError::Internal(e.to_string()))?;
            break;
        }
    }
    Ok(())
}

fn extract_tar_gz(buf: &[u8], _dest_dir: &Path, expected_binary: &Path) -> Result<(), AetherError> {
    use flate2::read::GzDecoder;
    use tar::Archive;

    let tar = GzDecoder::new(buf);
    let mut archive = Archive::new(tar);

    for entry in archive.entries().map_err(|e| AetherError::Internal(e.to_string()))? {
        let mut entry = entry.map_err(|e| AetherError::Internal(e.to_string()))?;
        let path = entry.path().map_err(|e| AetherError::Internal(e.to_string()))?;
        
        if path.to_string_lossy().contains("aether") {
            let mut outfile = File::create(expected_binary)
                .map_err(|e| AetherError::Internal(e.to_string()))?;
            std::io::copy(&mut entry, &mut outfile)
                .map_err(|e| AetherError::Internal(e.to_string()))?;
            break;
        }
    }
    Ok(())
}
