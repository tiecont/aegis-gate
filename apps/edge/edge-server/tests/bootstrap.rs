use std::process::Command;

#[test]
fn offline_check_reports_unready() {
    let output = Command::new(env!("CARGO_BIN_EXE_edge-server"))
        .arg("--check")
        .output()
        .unwrap();
    assert!(output.status.success());
    assert_eq!(
        String::from_utf8(output.stdout).unwrap(),
        "{\"component\":\"edge-server\",\"ready\":false,\"mode\":\"offline-foundation\"}\n"
    );
}

#[test]
fn negative_runtime_cannot_be_enabled_by_untrusted_flags() {
    for args in [
        vec![],
        vec!["--listen", "0.0.0.0:443"],
        vec!["--insecure"],
        vec!["--check", "--serve"],
    ] {
        let output = Command::new(env!("CARGO_BIN_EXE_edge-server"))
            .args(args)
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(78));
        assert!(output.stdout.is_empty());
    }
}
