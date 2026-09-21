mod pack_store;
mod provider_probe;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, path::PathBuf};
use tauri::{AppHandle, Manager};
use unicode_normalization::UnicodeNormalization;

const RUNTIME_VERSION: &str = "aitc-local-runtime-v1";
const QUEUE_SCHEMA: &str = "aitc-native-offline-queue-v1";
const CASE_CORPUS_ID: &str = "AITC-LLM-Case-Reasoning-v1";
const CASE_ENGINE: &str = "sqlite-fts5";
const CASE_TOP_K_MAX: u32 = 5;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStatus {
    runtime_version: &'static str,
    platform: &'static str,
    arch: &'static str,
    logical_cores: usize,
    onnx_runtime: &'static str,
    model_status: &'static str,
    production_vision_enabled: bool,
    limitations: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceProbe {
    schema_version: &'static str,
    platform: &'static str,
    arch: &'static str,
    logical_cores: usize,
    memory_mb: Option<u64>,
    storage_free_mb: Option<u64>,
    accelerators: Vec<Accelerator>,
    limitations: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Accelerator {
    id: &'static str,
    r#type: &'static str,
    provider: &'static str,
    ready: bool,
    precisions: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueueJob {
    idempotency_key: String,
    case_id: String,
    created_at: String,
    state: String,
    envelope: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueueFile {
    schema_version: String,
    jobs: Vec<QueueJob>,
}

impl Default for QueueFile {
    fn default() -> Self {
        Self { schema_version: QUEUE_SCHEMA.to_string(), jobs: Vec::new() }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalCasesStatus {
    corpus_id: &'static str,
    engine: &'static str,
    configured: bool,
    ready: bool,
    records: u64,
    source_counts: BTreeMap<String, u64>,
    error_code: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalCaseResult {
    id: i64,
    source_id: String,
    source_record_id: String,
    task: String,
    rank: f64,
    case_text: String,
    target: String,
    provenance: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalCasesSearchResult {
    corpus_id: &'static str,
    engine: &'static str,
    active: bool,
    terms: Vec<String>,
    limit: u32,
    returned: usize,
    cases: Vec<LocalCaseResult>,
    error_code: Option<String>,
}

fn platform_name() -> &'static str {
    #[cfg(target_os = "android")]
    { return "android"; }
    #[cfg(target_os = "windows")]
    { return "windows"; }
    #[allow(unreachable_code)]
    "unsupported"
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("APP_DATA_DIR:{e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("APP_DATA_CREATE:{e}"))?;
    Ok(dir)
}

fn queue_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("offline-queue-v1.json"))
}

fn cases_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("cases.sqlite"))
}

fn read_queue(app: &AppHandle) -> Result<QueueFile, String> {
    let path = queue_path(app)?;
    if !path.exists() { return Ok(QueueFile::default()); }
    let bytes = fs::read(path).map_err(|e| format!("QUEUE_READ:{e}"))?;
    let queue: QueueFile = serde_json::from_slice(&bytes).map_err(|e| format!("QUEUE_PARSE:{e}"))?;
    if queue.schema_version != QUEUE_SCHEMA { return Err("QUEUE_SCHEMA_INVALID".into()); }
    Ok(queue)
}

fn write_queue(app: &AppHandle, queue: &QueueFile) -> Result<(), String> {
    let path = queue_path(app)?;
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(queue).map_err(|e| format!("QUEUE_SERIALIZE:{e}"))?;
    fs::write(&tmp, bytes).map_err(|e| format!("QUEUE_TMP_WRITE:{e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("QUEUE_ATOMIC_RENAME:{e}"))?;
    Ok(())
}

fn open_cases_read_only(app: &AppHandle) -> Result<Connection, String> {
    let path = cases_path(app)?;
    if !path.exists() { return Err("snapshot-not-found".into()); }
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ).map_err(|_| "snapshot-open-failed".to_string())?;
    conn.execute_batch("PRAGMA query_only=ON;").map_err(|_| "snapshot-query-only-failed".to_string())?;
    Ok(conn)
}

fn truncate_chars(value: String, max: usize) -> String {
    let mut iter = value.chars();
    let out: String = iter.by_ref().take(max).collect();
    if iter.next().is_some() && max > 0 {
        let mut chars: Vec<char> = out.chars().collect();
        chars.pop();
        chars.push('…');
        chars.into_iter().collect()
    } else {
        out
    }
}

fn normalize_case_terms(values: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for raw in values.into_iter().take(14) {
        let mut term = String::new();
        for ch in raw.nfkc() {
            if ch.is_alphanumeric() || ch.is_whitespace() || ch == '-' {
                term.push(ch);
            }
            if term.chars().count() >= 48 { break; }
        }
        let normalized = term.split_whitespace().collect::<Vec<_>>().join(" ");
        if normalized.len() < 2 { continue; }
        if !out.iter().any(|x| x.eq_ignore_ascii_case(&normalized)) {
            out.push(normalized);
        }
    }
    out
}

fn local_cases_status_inner(app: &AppHandle) -> LocalCasesStatus {
    let configured = cases_path(app).map(|p| p.exists()).unwrap_or(false);
    if !configured {
        return LocalCasesStatus {
            corpus_id: CASE_CORPUS_ID,
            engine: CASE_ENGINE,
            configured: false,
            ready: false,
            records: 0,
            source_counts: BTreeMap::new(),
            error_code: Some("snapshot-not-found".into()),
        };
    }
    let conn = match open_cases_read_only(app) {
        Ok(conn) => conn,
        Err(code) => {
            return LocalCasesStatus {
                corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, configured: true, ready: false,
                records: 0, source_counts: BTreeMap::new(), error_code: Some(code),
            };
        }
    };
    let records: u64 = match conn.query_row("SELECT count(*) FROM cases", [], |row| row.get(0)) {
        Ok(v) => v,
        Err(_) => {
            return LocalCasesStatus {
                corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, configured: true, ready: false,
                records: 0, source_counts: BTreeMap::new(), error_code: Some("cases-table-invalid".into()),
            };
        }
    };
    if conn.prepare("SELECT rowid FROM cases_fts LIMIT 1").is_err() {
        return LocalCasesStatus {
            corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, configured: true, ready: false,
            records, source_counts: BTreeMap::new(), error_code: Some("cases-fts-invalid".into()),
        };
    }
    if records == 0 {
        return LocalCasesStatus {
            corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, configured: true, ready: false,
            records: 0, source_counts: BTreeMap::new(), error_code: Some("snapshot-empty".into()),
        };
    }
    let mut source_counts = BTreeMap::new();
    if let Ok(mut stmt) = conn.prepare("SELECT source_id,count(*) FROM cases GROUP BY source_id") {
        if let Ok(rows) = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, u64>(1)?))) {
            for row in rows.flatten() {
                source_counts.insert(row.0, row.1);
            }
        }
    }
    LocalCasesStatus {
        corpus_id: CASE_CORPUS_ID,
        engine: CASE_ENGINE,
        configured: true,
        ready: true,
        records,
        source_counts,
        error_code: None,
    }
}

#[tauri::command]
fn runtime_status() -> RuntimeStatus {
    RuntimeStatus {
        runtime_version: RUNTIME_VERSION,
        platform: platform_name(),
        arch: std::env::consts::ARCH,
        logical_cores: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        onnx_runtime: "not-bundled",
        model_status: "no-validated-native-model-bundled",
        production_vision_enabled: false,
        limitations: vec![
            "Native shell is operational but no validated ONNX model artifact is bundled yet.",
            "GPU/NPU providers remain disabled until provider discovery and quality validation pass.",
        ],
    }
}

#[tauri::command]
fn device_probe() -> DeviceProbe {
    let mut limitations = vec!["memory-and-storage-probe-pending-platform-adapter"];
    let mut accelerators = vec![Accelerator {
        id: "native-cpu",
        r#type: "cpu",
        provider: "cpu-baseline",
        ready: true,
        precisions: vec!["fp32"],
    }];
    #[cfg(target_os = "windows")]
    {
        limitations.push("directml-and-windows-ml-provider-probe-not-yet-verified");
        accelerators.push(Accelerator { id:"windows-gpu-candidate", r#type:"gpu", provider:"directml-candidate", ready:false, precisions:vec!["fp16","fp32"] });
        accelerators.push(Accelerator { id:"windows-npu-candidate", r#type:"npu", provider:"windows-ml-ep-candidate", ready:false, precisions:vec!["int8","fp16"] });
    }
    #[cfg(target_os = "android")]
    {
        limitations.push("qnn-litert-executorch-provider-probe-not-yet-verified");
        accelerators.push(Accelerator { id:"android-gpu-candidate", r#type:"gpu", provider:"android-gpu-candidate", ready:false, precisions:vec!["fp16","fp32"] });
        accelerators.push(Accelerator { id:"android-npu-candidate", r#type:"npu", provider:"android-npu-candidate", ready:false, precisions:vec!["int8","fp16"] });
    }
    DeviceProbe {
        schema_version: "aitc-device-probe-v1",
        platform: platform_name(),
        arch: std::env::consts::ARCH,
        logical_cores: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        memory_mb: None,
        storage_free_mb: None,
        accelerators,
        limitations,
    }
}

#[tauri::command]
fn sha256_bytes(bytes: Vec<u8>) -> String {
    hex::encode(Sha256::digest(bytes))
}

#[tauri::command]
fn queue_list(app: AppHandle) -> Result<QueueFile, String> {
    read_queue(&app)
}

#[tauri::command]
fn queue_enqueue(
    app: AppHandle,
    idempotency_key: String,
    case_id: String,
    created_at: String,
    envelope: serde_json::Value,
) -> Result<QueueFile, String> {
    if idempotency_key.len() < 8 || idempotency_key.len() > 160 { return Err("QUEUE_IDEMPOTENCY_KEY_INVALID".into()); }
    let mut queue = read_queue(&app)?;
    if queue.jobs.iter().any(|j| j.idempotency_key == idempotency_key) { return Ok(queue); }
    queue.jobs.push(QueueJob { idempotency_key, case_id, created_at, state: "pending".into(), envelope });
    write_queue(&app, &queue)?;
    Ok(queue)
}

#[tauri::command]
fn queue_ack(app: AppHandle, idempotency_key: String) -> Result<QueueFile, String> {
    let mut queue = read_queue(&app)?;
    if let Some(job) = queue.jobs.iter_mut().find(|j| j.idempotency_key == idempotency_key) {
        job.state = "sent".into();
    }
    write_queue(&app, &queue)?;
    Ok(queue)
}

#[tauri::command]
fn local_cases_status(app: AppHandle) -> LocalCasesStatus {
    local_cases_status_inner(&app)
}

#[tauri::command]
fn local_cases_search(app: AppHandle, terms: Vec<String>, limit: Option<u32>) -> LocalCasesSearchResult {
    let terms = normalize_case_terms(terms);
    let bounded = limit.unwrap_or(4).clamp(1, CASE_TOP_K_MAX);
    let status = local_cases_status_inner(&app);
    if !status.ready {
        return LocalCasesSearchResult {
            corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, active: false, terms, limit: bounded,
            returned: 0, cases: Vec::new(), error_code: status.error_code,
        };
    }
    if terms.is_empty() {
        return LocalCasesSearchResult {
            corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, active: true, terms, limit: bounded,
            returned: 0, cases: Vec::new(), error_code: Some("no-query-terms".into()),
        };
    }
    let conn = match open_cases_read_only(&app) {
        Ok(conn) => conn,
        Err(code) => {
            return LocalCasesSearchResult {
                corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, active: false, terms, limit: bounded,
                returned: 0, cases: Vec::new(), error_code: Some(code),
            };
        }
    };
    let fts_query = terms.iter().map(|term| format!("\"{}\"", term)).collect::<Vec<_>>().join(" OR ");
    let sql = "SELECT c.id,c.source_id,c.source_record_id,c.task,c.case_text,c.target,c.provenance_json,c.pmid,c.pmcid,c.doi,c.license,bm25(cases_fts) AS rank FROM cases_fts JOIN cases c ON c.id=cases_fts.rowid WHERE cases_fts MATCH ? ORDER BY rank ASC,c.id ASC LIMIT ?";
    let mut stmt = match conn.prepare(sql) {
        Ok(stmt) => stmt,
        Err(_) => {
            return LocalCasesSearchResult {
                corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, active: true, terms, limit: bounded,
                returned: 0, cases: Vec::new(), error_code: Some("query-prepare-failed".into()),
            };
        }
    };
    let rows = match stmt.query_map(params![fts_query, bounded], |row| {
        let provenance_json: String = row.get(6)?;
        let mut provenance = serde_json::from_str::<serde_json::Value>(&provenance_json)
            .unwrap_or_else(|_| serde_json::json!({}));
        if !provenance.is_object() { provenance = serde_json::json!({}); }
        if let Some(obj) = provenance.as_object_mut() {
            let license: String = row.get(10)?;
            let pmid: String = row.get(7)?;
            let pmcid: String = row.get(8)?;
            let doi: String = row.get(9)?;
            if !license.is_empty() { obj.insert("license".into(), serde_json::Value::String(license)); }
            if !pmid.is_empty() { obj.insert("pmid".into(), serde_json::Value::String(pmid)); }
            if !pmcid.is_empty() { obj.insert("pmcid".into(), serde_json::Value::String(pmcid)); }
            if !doi.is_empty() { obj.insert("doi".into(), serde_json::Value::String(doi)); }
        }
        Ok(LocalCaseResult {
            id: row.get(0)?,
            source_id: row.get::<_, String>(1)?,
            source_record_id: row.get::<_, String>(2)?,
            task: row.get::<_, String>(3)?,
            case_text: truncate_chars(row.get::<_, String>(4)?, 1200),
            target: truncate_chars(row.get::<_, String>(5)?, 650),
            provenance,
            rank: row.get::<_, f64>(11)?,
        })
    }) {
        Ok(rows) => rows,
        Err(_) => {
            return LocalCasesSearchResult {
                corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, active: true, terms, limit: bounded,
                returned: 0, cases: Vec::new(), error_code: Some("query-failed".into()),
            };
        }
    };
    let cases: Vec<LocalCaseResult> = rows.flatten().collect();
    LocalCasesSearchResult {
        corpus_id: CASE_CORPUS_ID, engine: CASE_ENGINE, active: true, terms, limit: bounded,
        returned: cases.len(), cases, error_code: None,
    }
}

fn trusted_pack_key() -> Result<VerifyingKey, String> {
    let raw_hex = option_env!("AITC_PACK_PUBLIC_KEY_HEX").unwrap_or("").trim();
    if raw_hex.is_empty() { return Err("PACK_KEY_NOT_CONFIGURED".into()); }
    let raw = hex::decode(raw_hex).map_err(|_| "PACK_KEY_HEX_INVALID".to_string())?;
    let bytes: [u8; 32] = raw.try_into().map_err(|_| "PACK_KEY_LENGTH_INVALID".to_string())?;
    VerifyingKey::from_bytes(&bytes).map_err(|_| "PACK_KEY_INVALID".to_string())
}

#[tauri::command]
fn verify_pack_signature(canonical_payload: String, signature_base64: String) -> Result<bool, String> {
    let key = trusted_pack_key()?;
    let sig_raw = BASE64.decode(signature_base64).map_err(|_| "PACK_SIGNATURE_BASE64_INVALID".to_string())?;
    let signature = Signature::from_slice(&sig_raw).map_err(|_| "PACK_SIGNATURE_LENGTH_INVALID".to_string())?;
    Ok(key.verify(canonical_payload.as_bytes(), &signature).is_ok())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            runtime_status,
            device_probe,
            sha256_bytes,
            queue_list,
            queue_enqueue,
            queue_ack,
            local_cases_status,
            local_cases_search,
            verify_pack_signature
        ])
        .run(tauri::generate_context!())
        .expect("error while running A.I Thiet Chan local runtime");
}
