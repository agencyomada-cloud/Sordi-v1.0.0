//! Standalone offline license-token generator — a dev-only CLI, never
//! bundled into the shipped app (Cargo compiles every `src/bin/*.rs` file
//! as its own separate binary; Tauri's bundler only packages the app's own
//! target declared in tauri.conf.json, so this binary and the private key
//! it embeds never ship in a real `.app`/installer). Run it with
//! `cargo run --bin keygen -- --help`.
//!
//! ## Read this before using it: what it can and can't do
//!
//! `license.rs`'s real `LicenseClaims` schema is
//! `{clientReferenceId, deviceFingerprint, iat, exp}` — there is no
//! `machineId` or `planType` field on the wire at all. One thing follows
//! from that, still load-bearing:
//!
//! **`--machine-id` (the human-readable "SRD-XXXX-XXXX-XXXX" code shown in
//! the app's ActivationModal) cannot be turned into a working token.** It's
//! deliberately a *separate*, cryptographically unlinked hash of the same
//! raw platform id (see license.rs's compute_machine_id doc comment) —
//! that's not an oversight here, it's the whole point of that design: the
//! display code must not leak anything that could be used to derive the
//! real `deviceFingerprint` a token is checked against. This tool accepts
//! `--machine-id` only as an optional label for your own record-keeping
//! (e.g. to note in a spreadsheet which customer this token was for) — it
//! is NEVER read for signing. The real cryptographic input is
//! `--device-fingerprint`, the raw SHA-256 hex digest
//! `compute_device_fingerprint()` produces on the customer's own machine.
//! There is currently no UI/command that shows a customer that value (only
//! the human-readable machine id is exposed), so today this tool is only
//! usable when you can run `cargo run --bin keygen -- --self-fingerprint`
//! *on* the target machine itself (e.g. over a remote screen-share with
//! the customer), or once a new "reveal my device fingerprint" affordance
//! is added somewhere support can read it from.
//!
//! What this tool produces IS directly usable two ways today: paste the
//! printed token straight into the app's "Clé de licence" field (a
//! JWT-shaped input there now short-circuits to fully offline verification
//! — see license.rs's `activate()`/`looks_like_jwt()`/`activate_offline()`
//! — no network round-trip to `apps/api` at all), or use `--output <path>`
//! to write it directly to a `license.token` file for manual delivery.

use app_lib::license::{compute_device_fingerprint, LicenseClaims};
use jsonwebtoken::{encode, EncodingKey, Header};

// STALE — this is the OLD dev/test Ed25519 private key. license.rs's
// LICENSE_PUBLIC_KEY_PEM has since been swapped to the real production
// public key (matching the production API at https://api.sordi.app), so
// this key's public half no longer matches it. Any token this binary signs
// today will FAIL to activate the real app — verify_signature_and_expiry()
// will reject it. This binary is not usable for producing real,
// activatable license tokens until DEV_PRIVATE_KEY_PEM below is replaced
// with the actual production private key (apps/api's real
// LICENSE_PRIVATE_KEY_PEM, deployed server-side only) — never commit that
// real key to this repo; if this tool needs to keep working locally,
// inject it via an environment variable read at build/run time instead of
// a compiled-in constant.
const DEV_PRIVATE_KEY_PEM: &str = "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIKNhRYsZAot08PVuxuSgcwJRKJ4FNwMadQSY/PJE1B0w\n-----END PRIVATE KEY-----\n";

const SECONDS_PER_DAY: u64 = 86_400;
const LIFETIME_PLAN_DAYS: u64 = 36_500; // ~100 years — there's no separate "lifetime" claim, just a very long expiry.

struct Args {
    device_fingerprint: Option<String>,
    machine_id_label: Option<String>,
    company: Option<String>,
    valid_days: u64,
    self_fingerprint: bool,
    output_path: Option<String>,
}

fn parse_args() -> Result<Args, String> {
    let mut device_fingerprint = None;
    let mut machine_id_label = None;
    let mut company = None;
    let mut valid_days: Option<u64> = None;
    let mut plan: Option<String> = None;
    let mut self_fingerprint = false;
    let mut output_path = None;

    let mut iter = std::env::args().skip(1);
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--device-fingerprint" => device_fingerprint = Some(iter.next().ok_or("--device-fingerprint needs a value")?),
            "--machine-id" => machine_id_label = Some(iter.next().ok_or("--machine-id needs a value")?),
            "--company" => company = Some(iter.next().ok_or("--company needs a value")?),
            "--valid-days" => {
                let raw = iter.next().ok_or("--valid-days needs a value")?;
                valid_days = Some(raw.parse::<u64>().map_err(|_| format!("--valid-days must be a positive integer, got: {raw}"))?);
            }
            "--plan" => plan = Some(iter.next().ok_or("--plan needs a value (annual | lifetime)")?),
            "--output" => output_path = Some(iter.next().ok_or("--output needs a path")?),
            "--self-fingerprint" => self_fingerprint = true,
            "--help" | "-h" => {
                print_help();
                std::process::exit(0);
            }
            other => return Err(format!("unrecognized argument: {other} (see --help)")),
        }
    }

    let valid_days = match (valid_days, plan.as_deref()) {
        (Some(days), _) => days,
        (None, Some("lifetime")) => LIFETIME_PLAN_DAYS,
        (None, Some("annual")) | (None, None) => 365,
        (None, Some(other)) => return Err(format!("unknown --plan '{other}' (expected 'annual' or 'lifetime')")),
    };

    Ok(Args { device_fingerprint, machine_id_label, company, valid_days, self_fingerprint, output_path })
}

fn print_help() {
    println!(
        "Sordi Invoicing offline license keygen (dev-only — see the module doc comment in src/bin/keygen.rs)\n\n\
         USAGE:\n  \
         cargo run --bin keygen -- [OPTIONS]\n\n\
         OPTIONS:\n  \
         --device-fingerprint <hex>   Required unless --self-fingerprint is passed. The real\n  \
         \x20                          cryptographic identity a token is checked against — the\n  \
         \x20                          raw SHA-256 hex digest compute_device_fingerprint() produces\n  \
         \x20                          on the customer's own machine. NOT the human-readable\n  \
         \x20                          SRD-XXXX-XXXX-XXXX code (see the module doc for why).\n  \
         --self-fingerprint            Use *this* machine's own fingerprint instead of\n  \
         \x20                          --device-fingerprint — for local testing/self-issuing.\n  \
         --machine-id <SRD-...>        Optional. Cosmetic only: printed alongside the token for\n  \
         \x20                          your own record-keeping, never read for signing.\n  \
         --company <name>              Maps to the token's clientReferenceId claim. Defaults to\n  \
         \x20                          \"unknown\".\n  \
         --valid-days <n>               Defaults to 365. Ignored if --plan is also passed.\n  \
         --plan <annual|lifetime>      Convenience for --valid-days (annual=365,\n  \
         \x20                          lifetime=~100 years) — there is no separate \"plan\" claim\n  \
         \x20                          on the wire, only an expiry.\n  \
         --output <path>               Also write the raw token to this file (e.g. a\n  \
         \x20                          license.token to hand over directly for manual delivery),\n  \
         \x20                          in addition to printing it to stdout. Overwrites silently.\n"
    );
}

fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock is before 1970")
        .as_secs()
}

fn main() {
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("error: {e}\n");
            print_help();
            std::process::exit(1);
        }
    };

    let device_fingerprint = if args.self_fingerprint {
        match compute_device_fingerprint() {
            Ok(fp) => fp,
            Err(e) => {
                eprintln!("error: --self-fingerprint failed: {e}");
                std::process::exit(1);
            }
        }
    } else {
        match args.device_fingerprint {
            Some(fp) => fp,
            None => {
                eprintln!(
                    "error: --device-fingerprint <hex> is required (or pass --self-fingerprint \
                     to sign for this machine). --machine-id alone is not enough — see the \
                     module doc comment in src/bin/keygen.rs for why."
                );
                std::process::exit(1);
            }
        }
    };

    if let Some(label) = &args.machine_id_label {
        eprintln!("(note: --machine-id {label} is a label only, not used for signing)");
    }

    let iat = now_unix();
    let exp = iat + args.valid_days * SECONDS_PER_DAY;

    let claims = LicenseClaims {
        client_reference_id: args.company.unwrap_or_else(|| "unknown".to_string()),
        device_fingerprint,
        iat,
        exp,
        // Offline-issued token: exp already reflects the real purchased
        // term (--valid-days), so real_expires_at is simply the same value
        // — same pattern as apps/api's trial issuance.
        real_expires_at: Some(exp),
    };

    let encoding_key = match EncodingKey::from_ed_pem(DEV_PRIVATE_KEY_PEM.as_bytes()) {
        Ok(k) => k,
        Err(e) => {
            eprintln!("error: invalid embedded private key: {e}");
            std::process::exit(1);
        }
    };

    let token = match encode(&Header::new(jsonwebtoken::Algorithm::EdDSA), &claims, &encoding_key) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("error: failed to sign token: {e}");
            std::process::exit(1);
        }
    };

    eprintln!(
        "Client reference : {}\nDevice fingerprint: {}\nIssued            : {}\nExpires           : {}\n",
        claims.client_reference_id,
        claims.device_fingerprint,
        iat,
        exp,
    );

    if let Some(path) = &args.output_path {
        if let Err(e) = std::fs::write(path, &token) {
            eprintln!("error: failed to write --output {path}: {e}");
            std::process::exit(1);
        }
        eprintln!("Written to {path} — hand this file to the customer as their license.token.\n");
    }

    eprintln!(
        "Paste the line below directly into the app's \"Clé de licence\" field (the\n\
         ActivationModal recognizes a raw token and activates it fully offline — see\n\
         license.rs's activate()/looks_like_jwt()):\n"
    );
    // Token on its own on stdout, everything else on stderr — so
    // `cargo run --bin keygen -- ... > token.txt` captures exactly the
    // token and nothing else, whether or not --output was also given.
    println!("{token}");
}
