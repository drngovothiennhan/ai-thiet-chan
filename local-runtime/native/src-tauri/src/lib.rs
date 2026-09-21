use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const RUNTIME_VERSION: &str = "aitc-local-runtime-v1";
const QUEUE_SCHEMA: &str = "aitc-native-offline-queue-v1";

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

fn platform_name() -> &'static str {
    #[cfg(target_os = "android")]
    { return "android"; }
    #[cfg(target_os = "windows")]
    { return "windows"; }
    #[allow(unreachable_code)]
    "unsupported"
}

fn queue_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("APP_DATA_DIR:{e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("APP_DATA_CREATE:{e}"))?;
    Ok(dir.join("offline-queue-v1.json"))
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
            verify_pack_signature
        ])
        .run(tauri::generate_context!())
        .expect("error while running A.I Thiet Chan local runtime");
}
