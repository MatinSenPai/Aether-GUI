use super::profiles::ConnectionProfile;

/// Aether (v1.0.1) prompts for exactly these three settings, in this exact
/// order, regardless of which protocol is chosen — confirmed by manually
/// running the real binary end to end with both MASQUE and WireGuard
/// selected; WireGuard/gool ask nothing extra (no key/endpoint prompts).
///
/// The literal input line Aether blocks on ("Choose [1-3] (default 1): ")
/// is NOT distinguishing text — it repeats verbatim between the "Protocol:"
/// and "IP version to scan:" prompts. Rules therefore match on the *header*
/// line that precedes each menu block ("Protocol:", "Scan mode:", "IP
/// version to scan:"), which are each unique. See aether/pty.rs's read loop
/// for how `header_matches` and `answer` are used together.
pub struct PromptRule {
    pub id: &'static str,
    pub header_matches: fn(&str) -> bool,
    pub answer: fn(&ConnectionProfile) -> String,
}

/// Matches on suffix, not exact equality: Aether sometimes prints a header
/// on the same raw line as the preceding info log (no `\n` in between, e.g.
/// `"...primary profile: balancedScan mode:"`), which an exact-equality
/// check would never match — silently starving that prompt of an answer
/// until Aether's own read times out and restarts the whole sequence from
/// Protocol (observed in production: an infinite Protocol/Scan-mode loop).
pub static PROMPT_TABLE: &[PromptRule] = &[
    PromptRule {
        id: "protocol",
        header_matches: |l| l.trim_end().ends_with("Protocol:"),
        answer: |p| p.protocol.as_menu_choice().to_string(),
    },
    PromptRule {
        id: "scan_mode",
        header_matches: |l| l.trim_end().ends_with("Scan mode:"),
        answer: |p| p.scan_mode.as_menu_choice().to_string(),
    },
    PromptRule {
        id: "ip_version",
        header_matches: |l| l.trim_end().ends_with("IP version to scan:"),
        answer: |p| p.ip_version.as_menu_choice().to_string(),
    },
];

/// True for a line that looks like Aether blocking on stdin for a menu
/// choice (real wording: "Choose [1-3] (default 1): ", "Choose [1-4]
/// (default 2): ", etc. — always ends with a colon, no trailing newline
/// since it's waiting for input right after printing this).
pub fn looks_like_choice_prompt(partial_line: &str) -> bool {
    let cleaned = partial_line.trim_end();
    cleaned.ends_with(':') || cleaned.contains("Choose [")
}
