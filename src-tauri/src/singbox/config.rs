use serde::Serialize;

/// Generates a sing-box config that routes all system traffic through
/// Aether's local SOCKS5 proxy via a TUN interface.
///
/// Uses sing-box 1.13+ config format with minimal route rules to avoid
/// conflicts between DNS interception and route-based forwarding.
pub fn generate_config(aether_socks_port: u16) -> String {
    let config = SingboxConfig {
        log: LogConfig { level: "info".into() },
        inbounds: vec![Inbound {
            type_: "tun".into(),
            tag: "tun-in".into(),
            interface_name: Some("aether-tun".into()),
            address: vec!["172.19.0.1/30".into()],
            auto_route: true,
            stack: "gvisor".into(),
        }],
        outbounds: vec![
            Outbound::socks("127.0.0.1", aether_socks_port),
            Outbound::direct(),
        ],
        dns: DnsConfig {
            servers: vec![
                DnsServer::https("dns-proxy", "1.1.1.1", "proxy"),
            ],
            rules: vec![
                DnsRule {
                    action: "route".into(),
                    server: "dns-proxy".into(),
                },
            ],
            final_: "dns-proxy".into(),
        },
        route: RouteConfig {
            rules: vec![
                RouteRule {
                    process_name: Some(vec![
                        "aether.exe".into(),
                        "sing-box.exe".into(),
                    ]),
                    outbound: Some("direct".into()),
                },
            ],
            final_: "proxy".into(),
            auto_detect_interface: true,
        },
    };

    serde_json::to_string_pretty(&config).expect("sing-box config serialization failed")
}

#[derive(Serialize)]
struct SingboxConfig {
    log: LogConfig,
    inbounds: Vec<Inbound>,
    outbounds: Vec<Outbound>,
    dns: DnsConfig,
    route: RouteConfig,
}

#[derive(Serialize)]
struct LogConfig {
    level: String,
}

#[derive(Serialize)]
struct Inbound {
    #[serde(rename = "type")]
    type_: String,
    tag: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    interface_name: Option<String>,
    address: Vec<String>,
    auto_route: bool,
    stack: String,
}

#[derive(Serialize)]
struct Outbound {
    #[serde(rename = "type")]
    type_: String,
    tag: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    server: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    server_port: Option<u16>,
}

impl Outbound {
    fn socks(server: &str, port: u16) -> Self {
        Self {
            type_: "socks".into(),
            tag: "proxy".into(),
            server: Some(server.into()),
            server_port: Some(port),
        }
    }

    fn direct() -> Self {
        Self {
            type_: "direct".into(),
            tag: "direct".into(),
            server: None,
            server_port: None,
        }
    }
}

#[derive(Serialize)]
struct DnsConfig {
    servers: Vec<DnsServer>,
    rules: Vec<DnsRule>,
    #[serde(rename = "final")]
    final_: String,
}

#[derive(Serialize)]
struct DnsServer {
    #[serde(rename = "type")]
    type_: String,
    tag: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    server: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    detour: Option<String>,
}

impl DnsServer {
    fn https(tag: &str, server: &str, detour: &str) -> Self {
        Self {
            type_: "https".into(),
            tag: tag.into(),
            server: Some(server.into()),
            detour: Some(detour.into()),
        }
    }
}

/// DNS rule that routes ALL DNS queries to the proxy DNS server.
/// In sing-box 1.13+, DNS rules without matching fields act as catch-alls.
/// The `dns.final` field provides the fallback for unmatched queries.
#[derive(Serialize)]
struct DnsRule {
    action: String,
    server: String,
}

#[derive(Serialize)]
struct RouteConfig {
    rules: Vec<RouteRule>,
    #[serde(rename = "final")]
    final_: String,
    #[serde(rename = "auto_detect_interface")]
    auto_detect_interface: bool,
}

/// Minimal route rule: only exclude sing-box/aether process traffic from
/// the TUN (prevents routing loop). Everything else goes through the proxy.
/// Removed: sniff, ip_is_private — these were interfering with DNS
/// interception and causing the "works 3 seconds then dies" behavior.
#[derive(Serialize)]
struct RouteRule {
    process_name: Option<Vec<String>>,
    outbound: Option<String>,
}
