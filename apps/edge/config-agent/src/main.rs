//! Offline contract check; successful parsing never activates configuration.
use edge_types::{ErrorEnvelope, MAX_ERROR_BYTES};
use std::{fs::File, io::Read, process::ExitCode};

fn main() -> ExitCode {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 2 || args[0] != "check-error" {
        eprintln!("usage: config-agent check-error <path>; offline error-envelope validation only");
        return ExitCode::from(64);
    }
    let mut bytes = Vec::new();
    let result = File::open(&args[1]).and_then(|file| {
        file.take((MAX_ERROR_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
    });
    if result.is_err() {
        eprintln!("cannot read error envelope");
        return ExitCode::from(66);
    }
    match ErrorEnvelope::parse(&bytes) {
        Ok(_) => {
            println!("error envelope valid; no configuration activated");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("{error}");
            ExitCode::from(65)
        }
    }
}
