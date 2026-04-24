// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportBinaryAssetPayload {
    relative_path: String,
    mime_type: String,
    base64_data: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportDocxPayload {
    output_path: String,
    markdown: String,
    assets: Vec<ExportBinaryAssetPayload>,
}

fn unique_export_dir() -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    std::env::temp_dir().join(format!("perfectmd-docx-export-{}-{}", std::process::id(), timestamp))
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("Failed to create export directory: {err}"))?;
    }
    Ok(())
}

fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    fn map_char(byte: u8) -> Result<Option<u8>, String> {
        let value = match byte {
            b'A'..=b'Z' => Some(byte - b'A'),
            b'a'..=b'z' => Some(byte - b'a' + 26),
            b'0'..=b'9' => Some(byte - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            b'=' => Some(64),
            b'\r' | b'\n' | b'\t' | b' ' => None,
            _ => return Err("Invalid base64 payload".to_string()),
        };
        Ok(value)
    }

    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    let mut chunk = [0u8; 4];
    let mut chunk_len = 0usize;

    for byte in input.bytes() {
        let Some(value) = map_char(byte)? else {
            continue;
        };
        chunk[chunk_len] = value;
        chunk_len += 1;

        if chunk_len == 4 {
            if chunk[0] == 64 || chunk[1] == 64 {
                return Err("Invalid base64 payload".to_string());
            }

            output.push((chunk[0] << 2) | (chunk[1] >> 4));

            if chunk[2] != 64 {
                output.push((chunk[1] << 4) | (chunk[2] >> 2));
            }
            if chunk[3] != 64 {
                output.push((chunk[2] << 6) | chunk[3]);
            }

            if chunk[2] == 64 || chunk[3] == 64 {
                chunk_len = 0;
                break;
            }

            chunk_len = 0;
        }
    }

    if chunk_len != 0 {
        return Err("Invalid base64 payload length".to_string());
    }

    Ok(output)
}

#[tauri::command]
fn export_docx(payload: ExportDocxPayload) -> Result<(), String> {
    let export_dir = unique_export_dir();

    let result = (|| -> Result<(), String> {
        fs::create_dir_all(&export_dir)
            .map_err(|err| format!("Failed to create temporary export directory: {err}"))?;

        let markdown_path = export_dir.join("document.md");
        fs::write(&markdown_path, payload.markdown.as_bytes())
            .map_err(|err| format!("Failed to write temporary markdown file: {err}"))?;

        for asset in payload.assets {
            let asset_path = export_dir.join(&asset.relative_path);
            ensure_parent_dir(&asset_path)?;
            let bytes = decode_base64(&asset.base64_data)?;
            fs::write(&asset_path, bytes)
                .map_err(|err| format!("Failed to write export asset ({}): {err}", asset.relative_path))?;
            let _ = asset.mime_type;
        }

        let command_output = Command::new("pandoc")
            .current_dir(&export_dir)
            .arg(markdown_path.as_os_str())
            .arg("--from=gfm+tex_math_dollars")
            .arg("--to=docx")
            .arg("--standalone")
            .arg("--resource-path")
            .arg(export_dir.as_os_str())
            .arg("--output")
            .arg(Path::new(&payload.output_path).as_os_str())
            .output();

        match command_output {
            Ok(output) if output.status.success() => Ok(()),
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let details = if stderr.trim().is_empty() { stdout.trim() } else { stderr.trim() };
                Err(format!("PANDOC_FAILED: {}", details))
            }
            Err(err) if err.kind() == ErrorKind::NotFound => Err(
                "PANDOC_NOT_FOUND: pandoc was not found in the current system PATH".to_string(),
            ),
            Err(err) => Err(format!("PANDOC_IO_ERROR: {err}")),
        }
    })();

    let _ = fs::remove_dir_all(&export_dir);
    result
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![export_docx])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
