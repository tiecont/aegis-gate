//! Offline foundation executable. It intentionally cannot open a traffic listener.
use policy_engine::BootstrapGate;
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() == 1 && args[0] == "--check" {
        let gate = BootstrapGate;
        println!(
            "{{\"component\":\"edge-server\",\"ready\":{},\"mode\":\"offline-foundation\"}}",
            gate.readiness()
        );
        return ExitCode::SUCCESS;
    }
    eprintln!(
        "edge runtime is unavailable until Pingora feasibility and signed configuration gates pass; use --check for offline diagnostics"
    );
    ExitCode::from(78)
}
