use std::{
    fs,
    process::Command,
    sync::atomic::{AtomicU64, Ordering},
};
static COUNTER: AtomicU64 = AtomicU64::new(0);

fn check(bytes: &[u8]) -> std::process::Output {
    let directory = std::env::temp_dir().join(format!(
        "aegisgate-contract-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir(&directory).unwrap();
    let path = directory.join("error.json");
    fs::write(&path, bytes).unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_config-agent"))
        .arg("check-error")
        .arg(path)
        .output()
        .unwrap();
    fs::remove_dir_all(directory).unwrap();
    output
}

#[test]
fn shared_fixture_is_consumed_without_configuration_activation() {
    let fixture = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../packages/contracts/fixtures/error.json"
    );
    let output = check(&fs::read(fixture).expect("shared Go/TS/Rust error fixture must exist"));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(
        String::from_utf8(output.stdout).unwrap(),
        "error envelope valid; no configuration activated\n"
    );
}

#[test]
fn negative_malformed_and_oversized_inputs_rejected_without_echo() {
    for input in [
        b"Bearer do-not-log-me".to_vec(),
        vec![b' '; edge_types::MAX_ERROR_BYTES + 1],
    ] {
        let output = check(&input);
        assert_eq!(output.status.code(), Some(65));
        assert!(output.stdout.is_empty());
        assert!(!String::from_utf8_lossy(&output.stderr).contains("do-not-log-me"));
    }
}

#[test]
fn negative_missing_file_does_not_disclose_path() {
    let output = Command::new(env!("CARGO_BIN_EXE_config-agent"))
        .args(["check-error", "/missing/secret-tenant-a.json"])
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(66));
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        "cannot read error envelope\n"
    );
}
