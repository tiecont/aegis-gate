//! Shared foundation wire invariants. This crate does not authenticate snapshots.
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

/// Integers remain exactly representable by the TypeScript dashboard.
pub const MAX_GENERATION: u64 = 9_007_199_254_740_991;
pub const MAX_ERROR_BYTES: usize = 16 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Generation(u64);

impl Generation {
    pub fn new(value: u64) -> Result<Self, ContractError> {
        if value == 0 || value > MAX_GENERATION {
            return Err(ContractError::InvalidGeneration);
        }
        Ok(Self(value))
    }

    pub fn get(self) -> u64 {
        self.0
    }

    /// Rollbacks must publish a new generation; wraparound is never valid.
    pub fn successor(self) -> Result<Self, ContractError> {
        self.0
            .checked_add(1)
            .ok_or(ContractError::InvalidGeneration)
            .and_then(Self::new)
    }

    pub fn require_newer_than(self, previous: Self) -> Result<(), ContractError> {
        if self.0 <= previous.0 {
            return Err(ContractError::Replay);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ErrorEnvelope {
    pub error: ApiError,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub request_id: String,
}

impl ErrorEnvelope {
    pub fn parse(input: &[u8]) -> Result<Self, ContractError> {
        if input.len() > MAX_ERROR_BYTES {
            return Err(ContractError::TooLarge);
        }
        let envelope: Self =
            serde_json::from_slice(input).map_err(|_| ContractError::InvalidJson)?;
        envelope.validate()?;
        Ok(envelope)
    }

    pub fn validate(&self) -> Result<(), ContractError> {
        let code = &self.error.code;
        if code.is_empty()
            || code.len() > 64
            || !code
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte == b'_')
        {
            return Err(ContractError::InvalidCode);
        }
        let message = &self.error.message;
        if message.is_empty()
            || message.chars().count() > 256
            || message.chars().any(char::is_control)
        {
            return Err(ContractError::InvalidMessage);
        }
        let id =
            Uuid::parse_str(&self.error.request_id).map_err(|_| ContractError::InvalidRequestId)?;
        if id.get_version_num() != 4
            || id.get_variant() != uuid::Variant::RFC4122
            || id.hyphenated().to_string() != self.error.request_id
        {
            return Err(ContractError::InvalidRequestId);
        }
        Ok(())
    }
}

/// Safe diagnostics deliberately exclude input bytes, paths and credentials.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContractError {
    InvalidJson,
    TooLarge,
    InvalidCode,
    InvalidMessage,
    InvalidRequestId,
    InvalidGeneration,
    Replay,
}

impl fmt::Display for ContractError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidJson => "invalid error envelope JSON",
            Self::TooLarge => "error envelope exceeds size limit",
            Self::InvalidCode => "invalid error code",
            Self::InvalidMessage => "invalid error message",
            Self::InvalidRequestId => "invalid request identifier",
            Self::InvalidGeneration => "invalid generation",
            Self::Replay => "generation is not newer",
        })
    }
}

impl std::error::Error for ContractError {}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid() -> ErrorEnvelope {
        ErrorEnvelope {
            error: ApiError {
                code: "unavailable".into(),
                message: "Service is not configured".into(),
                request_id: "e750f9a4-f82a-4d65-9f9d-526ec3604caa".into(),
            },
        }
    }

    #[test]
    fn valid_wire_round_trip() {
        let envelope = valid();
        let serialized = serde_json::to_vec(&envelope).unwrap();
        assert_eq!(ErrorEnvelope::parse(&serialized).unwrap(), envelope);
    }

    #[test]
    fn generation_is_monotonic_and_bounded() {
        let first = Generation::new(1).unwrap();
        let second = first.successor().unwrap();
        assert_eq!(second.get(), 2);
        assert_eq!(second.require_newer_than(first), Ok(()));
        assert_eq!(Generation::new(0), Err(ContractError::InvalidGeneration));
        assert_eq!(
            Generation::new(MAX_GENERATION + 1),
            Err(ContractError::InvalidGeneration)
        );
        assert_eq!(
            Generation::new(MAX_GENERATION).unwrap().successor(),
            Err(ContractError::InvalidGeneration)
        );
    }

    #[test]
    fn negative_generation_replay_and_rollback_denied() {
        let generation = Generation::new(3).unwrap();
        for older in [1, 2, 3] {
            assert_eq!(
                Generation::new(older)
                    .unwrap()
                    .require_newer_than(generation),
                Err(ContractError::Replay)
            );
        }
    }

    #[test]
    fn negative_unknown_duplicate_fields_and_trailing_data_denied() {
        for json in [
            r#"{"error":{"code":"not_found","message":"Not found","request_id":"e750f9a4-f82a-4d65-9f9d-526ec3604caa"},"tenant_id":"victim"}"#,
            r#"{"error":{"code":"not_found","message":"Not found","request_id":"e750f9a4-f82a-4d65-9f9d-526ec3604caa","secret":"hidden"}}"#,
            r#"{"error":{"code":"not_found","code":"forbidden","message":"Not found","request_id":"e750f9a4-f82a-4d65-9f9d-526ec3604caa"}}"#,
            r#"{"error":{"code":"not_found","message":"Not found","request_id":"e750f9a4-f82a-4d65-9f9d-526ec3604caa"}} {}"#,
        ] {
            assert_eq!(
                ErrorEnvelope::parse(json.as_bytes()),
                Err(ContractError::InvalidJson)
            );
        }
    }

    #[test]
    fn negative_untrusted_codes_and_messages_denied() {
        for code in ["", "FORBIDDEN", "not-found", "denied\r\nSet-Cookie"] {
            let mut envelope = valid();
            envelope.error.code = code.into();
            assert_eq!(envelope.validate(), Err(ContractError::InvalidCode));
        }
        for message in [String::new(), "x".repeat(257), "credential\nleak".into()] {
            let mut envelope = valid();
            envelope.error.message = message;
            assert_eq!(envelope.validate(), Err(ContractError::InvalidMessage));
        }
        let mut envelope = valid();
        envelope.error.code = "a".repeat(65);
        assert_eq!(envelope.validate(), Err(ContractError::InvalidCode));
    }

    #[test]
    fn negative_noncanonical_or_nonrandom_uuid_denied() {
        for request_id in [
            "00000000-0000-0000-0000-000000000000",
            "e750f9a4-f82a-1d65-9f9d-526ec3604caa",
            "e750f9a4-f82a-4d65-0f9d-526ec3604caa",
            "E750F9A4-F82A-4D65-9F9D-526EC3604CAA",
            "e750f9a4f82a4d659f9d526ec3604caa",
            "../../tenant-b",
        ] {
            let mut envelope = valid();
            envelope.error.request_id = request_id.into();
            assert_eq!(envelope.validate(), Err(ContractError::InvalidRequestId));
        }
    }

    #[test]
    fn negative_oversized_error_rejected_before_parsing() {
        assert_eq!(
            ErrorEnvelope::parse(&vec![b' '; MAX_ERROR_BYTES + 1]),
            Err(ContractError::TooLarge)
        );
    }

    #[test]
    fn negative_diagnostics_never_echo_secret_input() {
        let input = b"Bearer super-secret-fixture";
        let error = ErrorEnvelope::parse(input).unwrap_err();
        assert_eq!(error.to_string(), "invalid error envelope JSON");
    }
}
