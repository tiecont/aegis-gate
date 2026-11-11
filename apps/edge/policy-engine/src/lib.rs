//! Bootstrap policy gate only. Runtime policy evaluation starts after feasibility.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DenyReason {
    NoAuthenticatedConfiguration,
}

#[derive(Default)]
pub struct BootstrapGate;

impl BootstrapGate {
    pub fn readiness(&self) -> bool {
        false
    }

    pub fn authorize(&self) -> Result<(), DenyReason> {
        Err(DenyReason::NoAuthenticatedConfiguration)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn negative_bootstrap_never_authorizes_or_becomes_ready() {
        let gate = BootstrapGate;
        assert!(!gate.readiness());
        assert_eq!(
            gate.authorize(),
            Err(DenyReason::NoAuthenticatedConfiguration)
        );
    }
}
