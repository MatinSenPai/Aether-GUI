import type {
  IpVersion,
  MasqueNoize,
  Protocol,
  ScanMode,
  WgNoize,
} from "@/types/connection"

/** Short forms for the profile row and the connected stat grid — the long
 * forms live next to the controls that set them, where there is room to
 * explain the trade-off. */
export const PROTOCOL_SHORT: Record<Protocol, string> = {
  auto: "Auto",
  masque: "MASQUE",
  wireguard: "WireGuard",
  gool: "gool",
}

export const PROTOCOL_LABEL: Record<Protocol, string> = {
  auto: "Auto",
  masque: "MASQUE",
  wireguard: "WireGuard",
  gool: "WARP-in-WARP",
}

export const PROTOCOL_DESC: Record<Protocol, string> = {
  auto: "Lets Aether pick, starting from MASQUE. The right answer unless a specific network has beaten it.",
  masque:
    "Disguises the tunnel as ordinary HTTPS. Best chance of getting through, moderate speed.",
  wireguard:
    "Lighter and faster, but a recognisable fingerprint on strict networks.",
  gool: "Two nested WireGuard tunnels. Extra cover at a real speed cost.",
}

export const SCAN_LABEL: Record<ScanMode, string> = {
  turbo: "Turbo",
  balanced: "Balanced",
  thorough: "Thorough",
  stealth: "Stealth",
  ironclad: "Ironclad",
}

export const SCAN_DESC: Record<ScanMode, string> = {
  turbo:
    "Probes the fewest candidates and trusts the first that answers. Seconds, but a route can turn out dead.",
  balanced: "The default. Enough probes to be confident without a long wait.",
  thorough:
    "Widens the candidate pool. Better on networks that block most gateways.",
  stealth: "Slower, quieter probing — less traffic for a DPI box to notice.",
  ironclad:
    "Opens a real tunnel through each candidate and sends a real HTTP request before trusting it. Slowest, guaranteed working.",
}

export const IP_LABEL: Record<IpVersion, string> = {
  v4: "IPv4",
  v6: "IPv6",
  both: "Both",
}

export const MASQUE_NOIZE_LABEL: Record<MasqueNoize, string> = {
  off: "Off",
  firewall: "Firewall",
  gfw: "GFW",
}

export const MASQUE_NOIZE_DESC: Record<MasqueNoize, string> = {
  off: "No handshake disguise. Fastest — use only where DPI is not the problem.",
  firewall:
    "Pads and reshapes the handshake. Enough for most filtered networks.",
  gfw: "Heavier shaping with more decoy traffic. Escalate here when Firewall cannot get through.",
}

export const WG_NOIZE_LABEL: Record<WgNoize, string> = {
  off: "Off",
  light: "Light",
  balanced: "Balanced",
  aggressive: "Aggressive",
}

export const WG_NOIZE_DESC: Record<WgNoize, string> = {
  off: "No obfuscation. Only for open networks or testing.",
  light: "Minimal shaping with the least overhead.",
  balanced:
    "The default — a fair trade between stealth and speed for WireGuard traffic.",
  aggressive:
    "Heaviest shaping with the most decoy packets. For very strict networks.",
}

/** MASQUE carries the transport flag; WireGuard and gool ignore it. "auto"
 * starts from MASQUE, so it counts. */
export function usesMasque(protocol: Protocol): boolean {
  return protocol === "auto" || protocol === "masque"
}
