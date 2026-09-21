use libloading::Library;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{ffi::c_void, fs, path::PathBuf, time::Instant};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCandidate {
    id: String,
    accelerator_type: String,
    runtime_detected: bool,
    model_detected: bool,
    library_loadable: bool,
    session_load_success: bool,
    benchmark_success: bool,
    output_validated: bool,
    ready: bool,
    reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProbeResult {
    schema_version: &'static str,
    platform: &'static str,
    onnx_runtime_library: Option<String>,
    onnx_runtime_loadable: bool,
    active_vision_model: Option<String>,
    active_vision_model_sha256: Option<String>,
    production_vision_enabled: bool,
    providers: Vec<ProviderCandidate>,
    limitations: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuMicrobenchmarkResult {
    schema_version: &'static str,
    iterations: u64,
    elapsed_ms: f64,
    checksum: u64,
    benchmarked: bool,
    inference_provider: &'static str,
}

fn runtime_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(data) = app.path().app_data_dir() {
        let runtime = data.join("runtime");
        #[cfg(target_os = "windows")]
        out.push(runtime.join("onnxruntime.dll"));
        #[cfg(target_os = "android")]
        out.push(runtime.join("libonnxruntime.so"));
    }
    out
}

fn probe_ort_library(app: &AppHandle) -> (Option<PathBuf>, bool) {
    for path in runtime_candidates(app) {
        if !path.is_file() { continue; }
        let loaded = unsafe {
            match Library::new(&path) {
                Ok(lib) => lib.get::<unsafe extern "C" fn() -> *const c_void>(b"OrtGetApiBase\0").is_ok(),
                Err(_) => false,
            }
        };
        return (Some(path), loaded);
    }
    (None, false)
}

fn file_sha256(path: &PathBuf) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    Some(hex::encode(Sha256::digest(bytes)))
}

fn blocked_candidate(id: &str, accelerator_type: &str, runtime: bool, model: bool, loadable: bool, reason: &str) -> ProviderCandidate {
    ProviderCandidate {
        id:id.into(),
        accelerator_type:accelerator_type.into(),
        runtime_detected:runtime,
        model_detected:model,
        library_loadable:loadable,
        session_load_success:false,
        benchmark_success:false,
        output_validated:false,
        ready:false,
        reason:reason.into(),
    }
}

#[tauri::command]
pub fn inference_provider_probe(app: AppHandle) -> ProviderProbeResult {
    let (runtime_path, runtime_loadable) = probe_ort_library(&app);
    let model_path = crate::pack_store::active_artifact_path(&app, "vision-model", None);
    let model_sha = model_path.as_ref().and_then(file_sha256);
    let runtime_detected = runtime_path.is_some();
    let model_detected = model_path.is_some();
    let base_reason = if !model_detected {
        "validated-active-vision-model-missing"
    } else if !runtime_detected {
        "onnx-runtime-library-missing"
    } else if !runtime_loadable {
        "onnx-runtime-library-not-loadable"
    } else {
        "session-load-and-output-benchmark-adapter-not-wired"
    };
    let mut providers = vec![blocked_candidate("onnx-cpu","cpu",runtime_detected,model_detected,runtime_loadable,base_reason)];
    #[cfg(target_os = "windows")]
    {
        providers.push(blocked_candidate("directml","gpu",runtime_detected,model_detected,runtime_loadable,"directml-session-probe-not-wired"));
        providers.push(blocked_candidate("windows-ml-ep","npu",runtime_detected,model_detected,runtime_loadable,"windows-ml-session-probe-not-wired"));
    }
    #[cfg(target_os = "android")]
    {
        providers.push(blocked_candidate("qnn","npu",runtime_detected,model_detected,runtime_loadable,"qnn-session-probe-not-wired"));
        providers.push(blocked_candidate("android-gpu","gpu",runtime_detected,model_detected,runtime_loadable,"android-gpu-session-probe-not-wired"));
    }
    ProviderProbeResult {
        schema_version:"aitc-inference-provider-probe-v1",
        platform:crate::platform_name(),
        onnx_runtime_library:runtime_path.map(|p| p.to_string_lossy().to_string()),
        onnx_runtime_loadable:runtime_loadable,
        active_vision_model:model_path.map(|p| p.to_string_lossy().to_string()),
        active_vision_model_sha256:model_sha,
        production_vision_enabled:false,
        providers,
        limitations:vec![
            "Provider ready=true is forbidden until a real ONNX session loads, benchmark succeeds, and output validation passes.".into(),
            "The current repository still has no validated native ONNX vision artifact.".into(),
        ],
    }
}

#[tauri::command]
pub fn cpu_microbenchmark(iterations: Option<u64>) -> CpuMicrobenchmarkResult {
    let n = iterations.unwrap_or(2_000_000).clamp(100_000, 20_000_000);
    let start = Instant::now();
    let mut x = 0x9e3779b97f4a7c15u64;
    let mut acc = 0u64;
    for i in 0..n {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        acc = acc.wrapping_add(x.rotate_left((i & 31) as u32) ^ i);
    }
    let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
    CpuMicrobenchmarkResult {
        schema_version:"aitc-cpu-microbenchmark-v1",
        iterations:n,
        elapsed_ms,
        checksum:acc,
        benchmarked:true,
        inference_provider:"none",
    }
}
