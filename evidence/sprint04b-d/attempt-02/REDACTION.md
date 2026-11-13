# Attempt02 is ineligible

Root review identified that recording rendered Compose JSON can disclose
disposable credentials. The uncommitted `compose-config.stdout.txt` was removed
before evidence was committed. Do not reconstruct or retain that output.
`commands.json` and the original SHA256SUMS retain the historical command and
digest; the deliberately missing file means this attempt's original manifest
is incomplete. No complete-manifest or eligible regression PASS is claimed for
attempt02. Runtime commands did finish successfully with fixture cleanup, but
the source must be corrected and the entire regression rerun in a fresh attempt.

The corrected recorder never retains rendered Compose configuration. Existing
fixture scripts parse it only in subprocess memory. The owned stale-volume
probe prints only project/network names and boolean identity checks. No private
key or credential value is needed in evidence.
