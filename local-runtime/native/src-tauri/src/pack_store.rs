use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rusqlite::{Connection, OpenFlags};
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File},
    io::{Cursor, Read, Write},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

const PACK_STATE_SCHEMA: &str = "aitc-pack-state-v1";
const PACK_MANIFEST_SCHEMA: &str = "aitc-pack-manifest-v1";
const MAX_MANIFEST_BYTES: usize = 1024 * 1024;
const MAX_ARTIFACT_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_PACK_BYTES: u64 = 3 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PackArtifact {
    pub id: String,
    pub kind: String,
    pub version: String,
    pub path: String,
    pub size: u64,
    pub sha256: String,
    pub platforms: Vec<String>,
    #[serde(default)]
    pub min_runtime_version: Option<String>,
    #[serde(default)]
    pub hardware_constraints: Option<Value>,
    #[serde(default)]
    pub encrypted: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackSignature {
    algorithm: String,
    key_id: String,
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PackManifest {
    schema_version: String,
    pack_id: String,
    version: String,
    created_at: String,
    minimum_app_version: String,
    #[serde(default)]
    release_notes: Option<String>,
    artifacts: Vec<PackArtifact>,
    signature: PackSignature,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InstalledPack {
    pub pack_id: String,
    pub version: String,
    pub directory: String,
    pub manifest_sha256: String,
    pub installed_unix_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PackState {
    schema_version: String,
    generation: u64,
    pub active: Option<InstalledPack>,
    pub previous: Option<InstalledPack>,
}

impl Default for PackState {
    fn default() -> Self {
        Self {
            schema_version: PACK_STATE_SCHEMA.into(),
            generation: 0,
            active: None,
            previous: None,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackStatus {
    schema_version: &'static str,
    generation: u64,
    active: Option<InstalledPack>,
    previous: Option<InstalledPack>,
    active_directory_exists: bool,
    active_manifest_exists: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackInstallResult {
    installed: bool,
    activated: bool,
    idempotent: bool,
    pack_id: String,
    version: String,
    manifest_sha256: String,
    state: PackStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackHealthResult {
    ready: bool,
    pack_id: Option<String>,
    version: Option<String>,
    checked_artifacts: usize,
    error_code: Option<String>,
}

fn now_unix_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn packs_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| format!("APP_DATA_DIR:{e}"))?.join("packs");
    fs::create_dir_all(root.join("states")).map_err(|e| format!("PACK_STATES_DIR:{e}"))?;
    fs::create_dir_all(root.join("versions")).map_err(|e| format!("PACK_VERSIONS_DIR:{e}"))?;
    fs::create_dir_all(root.join("staging")).map_err(|e| format!("PACK_STAGING_DIR:{e}"))?;
    Ok(root)
}

fn valid_relative_path(value: &str) -> bool {
    if value.is_empty() || value.contains('\\') || value.starts_with('/') || value.contains(':') {
        return false;
    }
    let path = Path::new(value);
    path.components().all(|c| matches!(c, Component::Normal(_)))
}

fn safe_segment(value: &str) -> String {
    let out: String = value.chars().take(80).map(|c| {
        if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') { c } else { '_' }
    }).collect();
    if out.is_empty() { "pack".into() } else { out }
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn canonical_json(value: &Value) -> Result<String, String> {
    Ok(match value {
        Value::Null => "null".into(),
        Value::Bool(v) => if *v { "true".into() } else { "false".into() },
        Value::Number(v) => v.to_string(),
        Value::String(v) => serde_json::to_string(v).map_err(|_| "PACK_CANONICAL_STRING_FAILED".to_string())?,
        Value::Array(values) => {
            let mut out = String::from("[");
            for (i, item) in values.iter().enumerate() {
                if i > 0 { out.push(','); }
                out.push_str(&canonical_json(item)?);
            }
            out.push(']');
            out
        }
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let mut out = String::from("{");
            for (i, key) in keys.iter().enumerate() {
                if i > 0 { out.push(','); }
                out.push_str(&serde_json::to_string(key).map_err(|_| "PACK_CANONICAL_KEY_FAILED".to_string())?);
                out.push(':');
                out.push_str(&canonical_json(&map[*key])?);
            }
            out.push('}');
            out
        }
    })
}

fn trusted_pack_key(key_id: &str) -> Result<VerifyingKey, String> {
    let configured_id = option_env!("AITC_PACK_KEY_ID").unwrap_or("release-primary");
    if key_id != configured_id { return Err("PACK_KEY_ID_UNTRUSTED".into()); }
    let raw_hex = option_env!("AITC_PACK_PUBLIC_KEY_HEX").unwrap_or("").trim();
    if raw_hex.is_empty() { return Err("PACK_KEY_NOT_CONFIGURED".into()); }
    let raw = hex::decode(raw_hex).map_err(|_| "PACK_KEY_HEX_INVALID".to_string())?;
    let bytes: [u8; 32] = raw.try_into().map_err(|_| "PACK_KEY_LENGTH_INVALID".to_string())?;
    VerifyingKey::from_bytes(&bytes).map_err(|_| "PACK_KEY_INVALID".to_string())
}

fn verify_manifest_signature(raw: &[u8], manifest: &PackManifest) -> Result<(), String> {
    if manifest.signature.algorithm != "Ed25519" { return Err("PACK_SIGNATURE_ALGORITHM_INVALID".into()); }
    let mut value: Value = serde_json::from_slice(raw).map_err(|_| "PACK_MANIFEST_JSON_INVALID".to_string())?;
    let object = value.as_object_mut().ok_or_else(|| "PACK_MANIFEST_OBJECT_REQUIRED".to_string())?;
    object.remove("signature");
    let canonical = canonical_json(&value)?;
    let key = trusted_pack_key(&manifest.signature.key_id)?;
    let signature_raw = BASE64.decode(&manifest.signature.value).map_err(|_| "PACK_SIGNATURE_BASE64_INVALID".to_string())?;
    let signature = Signature::from_slice(&signature_raw).map_err(|_| "PACK_SIGNATURE_LENGTH_INVALID".to_string())?;
    key.verify(canonical.as_bytes(), &signature).map_err(|_| "PACK_SIGNATURE_INVALID".to_string())
}

fn validate_manifest(manifest: &PackManifest) -> Result<(), String> {
    if manifest.schema_version != PACK_MANIFEST_SCHEMA { return Err("PACK_MANIFEST_SCHEMA_INVALID".into()); }
    if manifest.pack_id.trim().is_empty() || manifest.version.trim().is_empty() { return Err("PACK_IDENTITY_INVALID".into()); }
    let current = Version::parse(env!("CARGO_PKG_VERSION")).map_err(|_| "APP_VERSION_INVALID".to_string())?;
    let minimum = Version::parse(&manifest.minimum_app_version).map_err(|_| "PACK_MIN_APP_VERSION_INVALID".to_string())?;
    if current < minimum { return Err("PACK_REQUIRES_NEWER_APP".into()); }
    if manifest.artifacts.is_empty() { return Err("PACK_ARTIFACTS_MISSING".into()); }
    let mut paths = BTreeSet::new();
    let mut total = 0u64;
    for artifact in &manifest.artifacts {
        if artifact.id.trim().is_empty() || artifact.kind.trim().is_empty() || artifact.version.trim().is_empty() {
            return Err("PACK_ARTIFACT_METADATA_INVALID".into());
        }
        if !valid_relative_path(&artifact.path) { return Err("PACK_ARTIFACT_PATH_INVALID".into()); }
        if !paths.insert(artifact.path.clone()) { return Err("PACK_ARTIFACT_PATH_DUPLICATE".into()); }
        if artifact.size > MAX_ARTIFACT_BYTES { return Err("PACK_ARTIFACT_TOO_LARGE".into()); }
        total = total.checked_add(artifact.size).ok_or_else(|| "PACK_SIZE_OVERFLOW".to_string())?;
        if total > MAX_PACK_BYTES { return Err("PACK_TOO_LARGE".into()); }
        if artifact.sha256.len() != 64 || !artifact.sha256.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("PACK_ARTIFACT_SHA_INVALID".into());
        }
        if artifact.platforms.is_empty() { return Err("PACK_ARTIFACT_PLATFORMS_MISSING".into()); }
        if artifact.encrypted.unwrap_or(false) {
            return Err("PACK_ENCRYPTED_ARTIFACT_DECRYPTOR_NOT_AVAILABLE".into());
        }
    }
    Ok(())
}

fn compatible(artifact: &PackArtifact) -> bool {
    let platform = crate::platform_name();
    artifact.platforms.iter().any(|p| p == "all" || p == platform)
}

fn state_files(root: &Path) -> Result<Vec<(u64, PathBuf)>, String> {
    let mut out = Vec::new();
    let dir = root.join("states");
    for entry in fs::read_dir(&dir).map_err(|e| format!("PACK_STATE_LIST:{e}"))? {
        let entry = entry.map_err(|e| format!("PACK_STATE_ENTRY:{e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("state-") || !name.ends_with(".json") { continue; }
        let generation = name.trim_start_matches("state-").trim_end_matches(".json").parse::<u64>();
        if let Ok(generation) = generation { out.push((generation, entry.path())); }
    }
    out.sort_by_key(|x| x.0);
    Ok(out)
}

fn read_state(root: &Path) -> PackState {
    let files = match state_files(root) { Ok(v) => v, Err(_) => return PackState::default() };
    for (_, path) in files.into_iter().rev() {
        if let Ok(bytes) = fs::read(path) {
            if let Ok(state) = serde_json::from_slice::<PackState>(&bytes) {
                if state.schema_version == PACK_STATE_SCHEMA { return state; }
            }
        }
    }
    PackState::default()
}

fn write_state(root: &Path, mut state: PackState) -> Result<PackState, String> {
    state.schema_version = PACK_STATE_SCHEMA.into();
    state.generation = state.generation.saturating_add(1);
    let dir = root.join("states");
    let tmp = dir.join(format!("state-{}.tmp", state.generation));
    let final_path = dir.join(format!("state-{}.json", state.generation));
    let bytes = serde_json::to_vec_pretty(&state).map_err(|_| "PACK_STATE_SERIALIZE_FAILED".to_string())?;
    {
        let mut file = File::create(&tmp).map_err(|e| format!("PACK_STATE_TMP_CREATE:{e}"))?;
        file.write_all(&bytes).map_err(|e| format!("PACK_STATE_TMP_WRITE:{e}"))?;
        file.sync_all().map_err(|e| format!("PACK_STATE_TMP_SYNC:{e}"))?;
    }
    fs::rename(&tmp, &final_path).map_err(|e| format!("PACK_STATE_COMMIT:{e}"))?;
    if let Ok(files) = state_files(root) {
        for (generation, path) in files {
            if generation.saturating_add(2) < state.generation {
                let _ = fs::remove_file(path);
            }
        }
    }
    Ok(state)
}

fn installed_dir(root: &Path, pack: &InstalledPack) -> PathBuf {
    root.join(&pack.directory)
}

fn pack_status_inner(app: &AppHandle) -> Result<PackStatus, String> {
    let root = packs_root(app)?;
    let state = read_state(&root);
    let active_dir = state.active.as_ref().map(|p| installed_dir(&root, p));
    Ok(PackStatus {
        schema_version: PACK_STATE_SCHEMA,
        generation: state.generation,
        active: state.active.clone(),
        previous: state.previous.clone(),
        active_directory_exists: active_dir.as_ref().map(|p| p.is_dir()).unwrap_or(false),
        active_manifest_exists: active_dir.as_ref().map(|p| p.join("manifest.json").is_file()).unwrap_or(false),
    })
}

fn read_manifest_from_dir(dir: &Path) -> Result<(PackManifest, Vec<u8>), String> {
    let raw = fs::read(dir.join("manifest.json")).map_err(|_| "PACK_MANIFEST_NOT_FOUND".to_string())?;
    if raw.len() > MAX_MANIFEST_BYTES { return Err("PACK_MANIFEST_TOO_LARGE".into()); }
    let manifest = serde_json::from_slice::<PackManifest>(&raw).map_err(|_| "PACK_MANIFEST_JSON_INVALID".to_string())?;
    Ok((manifest, raw))
}

fn sqlite_health(path: &Path, require_cases: bool) -> Result<(), String> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)
        .map_err(|_| "PACK_SQLITE_OPEN_FAILED".to_string())?;
    conn.execute_batch("PRAGMA query_only=ON;").map_err(|_| "PACK_SQLITE_QUERY_ONLY_FAILED".to_string())?;
    let quick: String = conn.query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|_| "PACK_SQLITE_QUICK_CHECK_FAILED".to_string())?;
    if quick.to_lowercase() != "ok" { return Err("PACK_SQLITE_CORRUPT".into()); }
    if require_cases {
        let fts_sql: String = conn.query_row(
            "SELECT sql FROM sqlite_master WHERE name='cases_fts'",
            [],
            |row| row.get(0),
        ).map_err(|_| "PACK_CASES_FTS_MISSING".to_string())?;
        if !fts_sql.to_lowercase().contains("fts5") { return Err("PACK_CASES_FTS_NOT_FTS5".into()); }
        let _: u64 = conn.query_row("SELECT count(*) FROM cases", [], |row| row.get(0))
            .map_err(|_| "PACK_CASES_TABLE_INVALID".to_string())?;
    }
    Ok(())
}

fn health_check_dir(dir: &Path, manifest: &PackManifest) -> Result<usize, String> {
    let mut checked = 0usize;
    for artifact in manifest.artifacts.iter().filter(|a| compatible(a)) {
        let path = dir.join(&artifact.path);
        if !path.is_file() { return Err("PACK_ARTIFACT_MISSING_AFTER_STAGE".into()); }
        let bytes = fs::read(&path).map_err(|_| "PACK_ARTIFACT_READ_FAILED".to_string())?;
        if bytes.len() as u64 != artifact.size { return Err("PACK_ARTIFACT_SIZE_MISMATCH".into()); }
        if sha256_hex(&bytes).to_lowercase() != artifact.sha256.to_lowercase() {
            return Err("PACK_ARTIFACT_DIGEST_MISMATCH".into());
        }
        match artifact.kind.as_str() {
            "knowledge-db" => {
                sqlite_health(&path, artifact.path.ends_with("cases.sqlite"))?;
            }
            "ontology" | "rules" | "prompt-pack" | "runtime-config" => {
                serde_json::from_slice::<Value>(&bytes).map_err(|_| "PACK_JSON_ARTIFACT_INVALID".to_string())?;
            }
            "vision-model" => {
                if !artifact.path.to_lowercase().ends_with(".onnx") || bytes.len() < 128 {
                    return Err("PACK_ONNX_ARTIFACT_SHAPE_INVALID".into());
                }
            }
            _ => {}
        }
        checked += 1;
    }
    if checked == 0 { return Err("PACK_NO_COMPATIBLE_ARTIFACTS".into()); }
    Ok(checked)
}

fn extract_and_verify(bytes: Vec<u8>, root: &Path) -> Result<(PackManifest, String, PathBuf, usize), String> {
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|_| "PACK_ARCHIVE_INVALID".to_string())?;
    let manifest_raw = {
        let mut entry = archive.by_name("manifest.json").map_err(|_| "PACK_MANIFEST_NOT_FOUND".to_string())?;
        if entry.size() as usize > MAX_MANIFEST_BYTES { return Err("PACK_MANIFEST_TOO_LARGE".into()); }
        let mut raw = Vec::with_capacity(entry.size() as usize);
        entry.read_to_end(&mut raw).map_err(|_| "PACK_MANIFEST_READ_FAILED".to_string())?;
        raw
    };
    let manifest: PackManifest = serde_json::from_slice(&manifest_raw).map_err(|_| "PACK_MANIFEST_JSON_INVALID".to_string())?;
    validate_manifest(&manifest)?;
    verify_manifest_signature(&manifest_raw, &manifest)?;
    let manifest_sha = sha256_hex(&manifest_raw);
    let stage = root.join("staging").join(format!(
        "{}-{}-{}",
        safe_segment(&manifest.pack_id),
        safe_segment(&manifest.version),
        &manifest_sha[..12]
    ));
    if stage.exists() { fs::remove_dir_all(&stage).map_err(|e| format!("PACK_STAGE_CLEAN:{e}"))?; }
    fs::create_dir_all(&stage).map_err(|e| format!("PACK_STAGE_CREATE:{e}"))?;
    fs::write(stage.join("manifest.json"), &manifest_raw).map_err(|e| format!("PACK_STAGE_MANIFEST_WRITE:{e}"))?;

    let result: Result<usize, String> = (|| {
        for artifact in manifest.artifacts.iter().filter(|a| compatible(a)) {
            let mut entry = archive.by_name(&artifact.path).map_err(|_| "PACK_ARCHIVE_ARTIFACT_MISSING".to_string())?;
            if entry.size() != artifact.size { return Err("PACK_ARCHIVE_ARTIFACT_SIZE_MISMATCH".into()); }
            let output = stage.join(&artifact.path);
            if let Some(parent) = output.parent() { fs::create_dir_all(parent).map_err(|_| "PACK_STAGE_PARENT_CREATE_FAILED".to_string())?; }
            let mut file = File::create(&output).map_err(|_| "PACK_STAGE_ARTIFACT_CREATE_FAILED".to_string())?;
            let mut hasher = Sha256::new();
            let mut copied = 0u64;
            let mut buffer = [0u8; 64 * 1024];
            loop {
                let n = entry.read(&mut buffer).map_err(|_| "PACK_ARCHIVE_ARTIFACT_READ_FAILED".to_string())?;
                if n == 0 { break; }
                copied = copied.saturating_add(n as u64);
                if copied > artifact.size { return Err("PACK_ARCHIVE_ARTIFACT_OVERFLOW".into()); }
                hasher.update(&buffer[..n]);
                file.write_all(&buffer[..n]).map_err(|_| "PACK_STAGE_ARTIFACT_WRITE_FAILED".to_string())?;
            }
            file.sync_all().map_err(|_| "PACK_STAGE_ARTIFACT_SYNC_FAILED".to_string())?;
            if copied != artifact.size { return Err("PACK_ARCHIVE_ARTIFACT_TRUNCATED".into()); }
            if hex::encode(hasher.finalize()).to_lowercase() != artifact.sha256.to_lowercase() {
                return Err("PACK_ARTIFACT_DIGEST_MISMATCH".into());
            }
        }
        health_check_dir(&stage, &manifest)
    })();

    match result {
        Ok(checked) => Ok((manifest, manifest_sha, stage, checked)),
        Err(err) => {
            let _ = fs::remove_dir_all(&stage);
            Err(err)
        }
    }
}

#[tauri::command]
pub fn pack_status(app: AppHandle) -> Result<PackStatus, String> {
    pack_status_inner(&app)
}

#[tauri::command]
pub fn install_pack_archive(app: AppHandle, bytes: Vec<u8>) -> Result<PackInstallResult, String> {
    let root = packs_root(&app)?;
    let current = read_state(&root);
    let (manifest, manifest_sha, stage, _) = extract_and_verify(bytes, &root)?;

    if let Some(active) = &current.active {
        if active.pack_id == manifest.pack_id {
            let active_version = Version::parse(&active.version).map_err(|_| "PACK_ACTIVE_VERSION_INVALID".to_string())?;
            let incoming_version = Version::parse(&manifest.version).map_err(|_| "PACK_VERSION_INVALID".to_string())?;
            if incoming_version < active_version {
                let _ = fs::remove_dir_all(&stage);
                return Err("PACK_ANTI_ROLLBACK_REJECTED".into());
            }
            if incoming_version == active_version {
                let _ = fs::remove_dir_all(&stage);
                if active.manifest_sha256 == manifest_sha {
                    return Ok(PackInstallResult {
                        installed: false, activated: false, idempotent: true,
                        pack_id: manifest.pack_id, version: manifest.version, manifest_sha256: manifest_sha,
                        state: pack_status_inner(&app)?,
                    });
                }
                return Err("PACK_VERSION_CONTENT_CONFLICT".into());
            }
        }
    }

    let directory = format!(
        "versions/{}-{}-{}",
        safe_segment(&manifest.pack_id),
        safe_segment(&manifest.version),
        &manifest_sha[..12]
    );
    let final_dir = root.join(&directory);
    if final_dir.exists() {
        let (existing_manifest, existing_raw) = read_manifest_from_dir(&final_dir)?;
        if sha256_hex(&existing_raw) != manifest_sha || existing_manifest.pack_id != manifest.pack_id || existing_manifest.version != manifest.version {
            let _ = fs::remove_dir_all(&stage);
            return Err("PACK_VERSION_DIRECTORY_CONFLICT".into());
        }
        health_check_dir(&final_dir, &existing_manifest)?;
        let _ = fs::remove_dir_all(&stage);
    } else {
        fs::rename(&stage, &final_dir).map_err(|e| format!("PACK_VERSION_COMMIT:{e}"))?;
    }

    let installed = InstalledPack {
        pack_id: manifest.pack_id.clone(),
        version: manifest.version.clone(),
        directory,
        manifest_sha256: manifest_sha.clone(),
        installed_unix_ms: now_unix_ms(),
    };
    let next = PackState {
        schema_version: PACK_STATE_SCHEMA.into(),
        generation: current.generation,
        previous: current.active.clone(),
        active: Some(installed),
    };
    write_state(&root, next)?;
    Ok(PackInstallResult {
        installed: true, activated: true, idempotent: false,
        pack_id: manifest.pack_id, version: manifest.version, manifest_sha256: manifest_sha,
        state: pack_status_inner(&app)?,
    })
}

#[tauri::command]
pub fn rollback_pack(app: AppHandle) -> Result<PackStatus, String> {
    let root = packs_root(&app)?;
    let current = read_state(&root);
    let previous = current.previous.clone().ok_or_else(|| "PACK_ROLLBACK_NOT_AVAILABLE".to_string())?;
    let previous_dir = installed_dir(&root, &previous);
    let (manifest, _) = read_manifest_from_dir(&previous_dir)?;
    health_check_dir(&previous_dir, &manifest)?;
    let next = PackState {
        schema_version: PACK_STATE_SCHEMA.into(),
        generation: current.generation,
        active: Some(previous),
        previous: current.active.clone(),
    };
    write_state(&root, next)?;
    pack_status_inner(&app)
}

#[tauri::command]
pub fn recheck_active_pack(app: AppHandle) -> PackHealthResult {
    let root = match packs_root(&app) {
        Ok(root) => root,
        Err(code) => return PackHealthResult { ready:false, pack_id:None, version:None, checked_artifacts:0, error_code:Some(code) },
    };
    let state = read_state(&root);
    let active = match state.active {
        Some(active) => active,
        None => return PackHealthResult { ready:false, pack_id:None, version:None, checked_artifacts:0, error_code:Some("PACK_ACTIVE_MISSING".into()) },
    };
    let dir = installed_dir(&root, &active);
    match read_manifest_from_dir(&dir).and_then(|(manifest, _)| health_check_dir(&dir, &manifest).map(|n| (manifest, n))) {
        Ok((manifest, checked)) => PackHealthResult {
            ready:true, pack_id:Some(manifest.pack_id), version:Some(manifest.version), checked_artifacts:checked, error_code:None
        },
        Err(code) => PackHealthResult {
            ready:false, pack_id:Some(active.pack_id), version:Some(active.version), checked_artifacts:0, error_code:Some(code)
        }
    }
}

pub(crate) fn active_artifact_path(app: &AppHandle, kind: &str, filename: Option<&str>) -> Option<PathBuf> {
    let root = packs_root(app).ok()?;
    let state = read_state(&root);
    let active = state.active?;
    let dir = installed_dir(&root, &active);
    let (manifest, _) = read_manifest_from_dir(&dir).ok()?;
    let artifact = manifest.artifacts.iter().find(|a| {
        compatible(a) && a.kind == kind && filename.map(|name| Path::new(&a.path).file_name().and_then(|x| x.to_str()) == Some(name)).unwrap_or(true)
    })?;
    let path = dir.join(&artifact.path);
    if path.is_file() { Some(path) } else { None }
}

pub(crate) fn active_artifact_metadata(app: &AppHandle, kind: &str) -> Option<PackArtifact> {
    let root = packs_root(app).ok()?;
    let state = read_state(&root);
    let active = state.active?;
    let dir = installed_dir(&root, &active);
    let (manifest, _) = read_manifest_from_dir(&dir).ok()?;
    manifest.artifacts.into_iter().find(|a| compatible(a) && a.kind == kind)
}
