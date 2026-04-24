// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Deserialize;
use tauri::{path::BaseDirectory, Manager};
use tauri_plugin_shell::ShellExt;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

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
    title: String,
    html: String,
    assets: Vec<ExportBinaryAssetPayload>,
    inline_styles: Vec<ExportInlineStylePayload>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportInlineStylePayload {
    style_id: String,
    color: Option<String>,
    background_color: Option<String>,
    font_size_half_points: Option<u16>,
}

struct PandocOutput {
    success: bool,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn is_missing_pandoc_error(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("program not allowed")
        || normalized.contains("no such file or directory")
        || normalized.contains("the system cannot find the file specified")
        || normalized.contains("sidecar not allowed")
}

async fn run_pandoc(app: &tauri::AppHandle, cwd: &Path, args: &[String]) -> Result<PandocOutput, String> {
    if let Ok(command) = app.shell().sidecar("pandoc") {
        match command.current_dir(cwd).args(args).output().await {
            Ok(output) => {
                return Ok(PandocOutput {
                    success: output.status.success(),
                    stdout: output.stdout,
                    stderr: output.stderr,
                })
            }
            Err(err) => {
                let message = err.to_string();
                if !is_missing_pandoc_error(&message) {
                    return Err(format!("PANDOC_SIDECAR_IO_ERROR: {err}"));
                }
            }
        }
    }

    match app
        .shell()
        .command("pandoc")
        .current_dir(cwd)
        .args(args)
        .output()
        .await
    {
        Ok(output) => Ok(PandocOutput {
            success: output.status.success(),
            stdout: output.stdout,
            stderr: output.stderr,
        }),
        Err(err) => {
            let message = err.to_string();
            if is_missing_pandoc_error(&message) {
                return Err("PANDOC_NOT_FOUND: bundled pandoc is unavailable and pandoc was not found in the current system PATH".to_string());
            }
            Err(format!("PANDOC_IO_ERROR: {err}"))
        }
    }
}

fn resolve_optional_resource(app: &tauri::AppHandle, relative_path: &str) -> Option<PathBuf> {
    let candidates = [relative_path.to_string(), format!("resources/{relative_path}")];
    for candidate in candidates {
        if let Ok(path) = app.path().resolve(&candidate, BaseDirectory::Resource) {
            if path.exists() {
                return Some(path);
            }
        }
    }
    None
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

fn sanitize_metadata_value(value: &str) -> String {
    value.replace('\r', " ").replace('\n', " ").trim().to_string()
}

fn escape_xml_attr(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn build_inline_style_fragment(style: &ExportInlineStylePayload) -> String {
    let mut rpr = String::new();

    if let Some(color) = style.color.as_deref() {
        rpr.push_str(&format!(r#"<w:color w:val="{}"/>"#, escape_xml_attr(color)));
    }

    if let Some(background_color) = style.background_color.as_deref() {
        rpr.push_str(&format!(
            r#"<w:shd w:val="clear" w:color="auto" w:fill="{}"/>"#,
            escape_xml_attr(background_color)
        ));
    }

    if let Some(font_size_half_points) = style.font_size_half_points {
        rpr.push_str(&format!(
            r#"<w:sz w:val="{0}"/><w:szCs w:val="{0}"/>"#,
            font_size_half_points
        ));
    }

    format!(
        r#"<w:style w:type="character" w:customStyle="1" w:styleId="{id}"><w:name w:val="{name}"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr>{rpr}</w:rPr></w:style>"#,
        id = escape_xml_attr(&style.style_id),
        name = escape_xml_attr(&style.style_id),
        rpr = rpr
    )
}

fn collect_files(root: &Path, dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|err| format!("Failed to read directory {}: {err}", dir.display()))? {
        let entry = entry.map_err(|err| format!("Failed to read directory entry in {}: {err}", dir.display()))?;
        let path = entry.path();
        if path.is_dir() {
            collect_files(root, &path, files)?;
        } else if path.is_file() {
            let relative = path
                .strip_prefix(root)
                .map_err(|err| format!("Failed to resolve relative path for {}: {err}", path.display()))?;
            files.push(relative.to_path_buf());
        }
    }
    Ok(())
}

fn extract_zip_archive(source: &Path, destination: &Path) -> Result<(), String> {
    let file = fs::File::open(source)
        .map_err(|err| format!("Failed to open {}: {err}", source.display()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|err| format!("Failed to read zip archive {}: {err}", source.display()))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|err| format!("Failed to read zip entry #{index} from {}: {err}", source.display()))?;
        let Some(relative_path) = entry.enclosed_name().map(|path| path.to_owned()) else {
            continue;
        };
        let output_path = destination.join(relative_path);
        if entry.name().ends_with('/') {
            fs::create_dir_all(&output_path)
                .map_err(|err| format!("Failed to create directory {}: {err}", output_path.display()))?;
            continue;
        }

        ensure_parent_dir(&output_path)?;
        let mut output_file = fs::File::create(&output_path)
            .map_err(|err| format!("Failed to create {}: {err}", output_path.display()))?;
        std::io::copy(&mut entry, &mut output_file)
            .map_err(|err| format!("Failed to extract {}: {err}", output_path.display()))?;
    }

    Ok(())
}

fn rebuild_zip_archive(source_dir: &Path, destination: &Path) -> Result<(), String> {
    let file = fs::File::create(destination)
        .map_err(|err| format!("Failed to create {}: {err}", destination.display()))?;
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let mut files = Vec::new();
    collect_files(source_dir, source_dir, &mut files)?;
    files.sort();

    for relative_path in files {
        let absolute_path = source_dir.join(&relative_path);
        let archive_path = relative_path.to_string_lossy().replace('\\', "/");
        writer
            .start_file(&archive_path, options)
            .map_err(|err| format!("Failed to add {archive_path} to archive: {err}"))?;
        let mut input_file = fs::File::open(&absolute_path)
            .map_err(|err| format!("Failed to open {}: {err}", absolute_path.display()))?;
        let mut buffer = Vec::new();
        input_file
            .read_to_end(&mut buffer)
            .map_err(|err| format!("Failed to read {}: {err}", absolute_path.display()))?;
        writer
            .write_all(&buffer)
            .map_err(|err| format!("Failed to write {archive_path} to archive: {err}"))?;
    }

    writer
        .finish()
        .map_err(|err| format!("Failed to finalize {}: {err}", destination.display()))?;
    Ok(())
}

fn inject_inline_styles(reference_doc_path: &Path, inline_styles: &[ExportInlineStylePayload]) -> Result<(), String> {
    if inline_styles.is_empty() {
        return Ok(());
    }

    let extract_dir = reference_doc_path.with_extension("docx.parts");
    if extract_dir.exists() {
        fs::remove_dir_all(&extract_dir)
            .map_err(|err| format!("Failed to clear {}: {err}", extract_dir.display()))?;
    }
    fs::create_dir_all(&extract_dir)
        .map_err(|err| format!("Failed to create {}: {err}", extract_dir.display()))?;

    let result = (|| {
        extract_zip_archive(reference_doc_path, &extract_dir)?;
        let styles_path = extract_dir.join("word").join("styles.xml");
        let styles_xml = fs::read_to_string(&styles_path)
            .map_err(|err| format!("Failed to read {}: {err}", styles_path.display()))?;

        let fragments = inline_styles
            .iter()
            .map(build_inline_style_fragment)
            .collect::<Vec<_>>()
            .join("");

        let Some((prefix, suffix)) = styles_xml.rsplit_once("</w:styles>") else {
            return Err(format!("Failed to patch {}: missing </w:styles>", styles_path.display()));
        };
        let patched_xml = format!("{prefix}{fragments}</w:styles>{suffix}");
        fs::write(&styles_path, patched_xml)
            .map_err(|err| format!("Failed to write {}: {err}", styles_path.display()))?;

        rebuild_zip_archive(&extract_dir, reference_doc_path)
    })();

    if let Err(err) = fs::remove_dir_all(&extract_dir) {
        if result.is_ok() {
            return Err(format!("Failed to clean {}: {err}", extract_dir.display()));
        }
    }

    result
}

fn prepare_reference_doc(
    app: &tauri::AppHandle,
    export_dir: &Path,
    inline_styles: &[ExportInlineStylePayload],
) -> Result<Option<PathBuf>, String> {
    let Some(reference_doc_path) = resolve_optional_resource(app, "reference.docx") else {
        return Ok(None);
    };

    if inline_styles.is_empty() {
        return Ok(Some(reference_doc_path));
    }

    let generated_reference_path = export_dir.join("reference.docx");
    fs::copy(&reference_doc_path, &generated_reference_path).map_err(|err| {
        format!(
            "Failed to prepare Word style template from {}: {err}",
            reference_doc_path.display()
        )
    })?;
    inject_inline_styles(&generated_reference_path, inline_styles)?;
    Ok(Some(generated_reference_path))
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
async fn export_docx(app: tauri::AppHandle, payload: ExportDocxPayload) -> Result<(), String> {
    let export_dir = unique_export_dir();

    let result = async {
        fs::create_dir_all(&export_dir)
            .map_err(|err| format!("Failed to create temporary export directory: {err}"))?;

        let html_path = export_dir.join("document.html");
        fs::write(&html_path, payload.html.as_bytes())
            .map_err(|err| format!("Failed to write temporary HTML file: {err}"))?;

        for asset in payload.assets {
            let asset_path = export_dir.join(&asset.relative_path);
            ensure_parent_dir(&asset_path)?;
            let bytes = decode_base64(&asset.base64_data)?;
            fs::write(&asset_path, bytes)
                .map_err(|err| format!("Failed to write export asset ({}): {err}", asset.relative_path))?;
            let _ = asset.mime_type;
        }

        let sanitized_title = sanitize_metadata_value(&payload.title);
        let pandoc_args = vec![
            html_path.to_string_lossy().to_string(),
            "--from=html+tex_math_dollars+native_spans+native_divs".to_string(),
            "--to=docx".to_string(),
            "--standalone".to_string(),
            "--syntax-highlighting=tango".to_string(),
            "--metadata".to_string(),
            format!("title={}", if sanitized_title.is_empty() { "Untitled".to_string() } else { sanitized_title }),
            "--metadata".to_string(),
            "lang=zh-CN".to_string(),
            "--resource-path".to_string(),
            export_dir.to_string_lossy().to_string(),
        ];

        let mut pandoc_args = pandoc_args;
        if let Some(reference_doc_path) = prepare_reference_doc(&app, &export_dir, &payload.inline_styles)? {
            pandoc_args.push("--reference-doc".to_string());
            pandoc_args.push(reference_doc_path.to_string_lossy().to_string());
        }
        pandoc_args.push("--output".to_string());
        pandoc_args.push(Path::new(&payload.output_path).to_string_lossy().to_string());

        let command_output = run_pandoc(&app, &export_dir, &pandoc_args).await?;

        if command_output.success {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&command_output.stderr);
            let stdout = String::from_utf8_lossy(&command_output.stdout);
            let details = if stderr.trim().is_empty() { stdout.trim() } else { stderr.trim() };
            Err(format!("PANDOC_FAILED: {}", details))
        }
    }
    .await;

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
