import { Switch } from "@/components/ui/switch"
import { BindAddressField } from "@/components/BindAddressField"
import { CloseToTrayToggle } from "@/components/CloseToTrayToggle"
import { RoutingSettings } from "@/components/RoutingSettings"
import { ZeroTrustSettings } from "@/components/ZeroTrustSettings"
import {
  Chip,
  Note,
  RadioCard,
  Section,
  Segmented,
  ToggleRow,
} from "@/components/settings/SettingsPrimitives"
import { isLocked } from "@/lib/connectionView"
import {
  IP_LABEL,
  MASQUE_NOIZE_DESC,
  MASQUE_NOIZE_LABEL,
  PROTOCOL_DESC,
  PROTOCOL_LABEL,
  SCAN_DESC,
  SCAN_LABEL,
  WG_NOIZE_DESC,
  WG_NOIZE_LABEL,
  usesMasque,
} from "@/lib/profileLabels"
import { useConnectionStore } from "@/state/connectionStore"
import type {
  IpVersion,
  MasqueNoize,
  Protocol,
  ScanMode,
  WgNoize,
} from "@/types/connection"

const PROTOCOLS: Protocol[] = ["auto", "masque", "wireguard", "gool"]
const SCANS: ScanMode[] = [
  "turbo",
  "balanced",
  "thorough",
  "stealth",
  "ironclad",
]
const IPS: IpVersion[] = ["v4", "v6", "both"]
const MASQUE_NOIZES: MasqueNoize[] = ["off", "firewall", "gfw"]
const WG_NOIZES: WgNoize[] = ["off", "light", "balanced", "aggressive"]

/**
 * Every option Aether's own interactive setup exposes (see aether/prompts.rs
 * and profiles.rs — nothing else), laid out so each one carries its
 * trade-off as visible copy rather than a hover tooltip. Scan mode and
 * obfuscation are single axes running faster → more certain and quieter →
 * louder, not dropdowns of five nouns.
 *
 * Everything on this panel except the tray preference is locked once a
 * session exists: Aether can't switch protocol, transport or scan mode
 * mid-run, so offering the control would be a lie.
 */
export function SettingsPanel() {
  const status = useConnectionStore((s) => s.status)
  const profile = useConnectionStore((s) => s.profile)
  const setProtocol = useConnectionStore((s) => s.setProtocol)
  const setScanMode = useConnectionStore((s) => s.setScanMode)
  const setIpVersion = useConnectionStore((s) => s.setIpVersion)
  const setMasqueHttp2 = useConnectionStore((s) => s.setMasqueHttp2)
  const setMasqueNoize = useConnectionStore((s) => s.setMasqueNoize)
  const setWgNoize = useConnectionStore((s) => s.setWgNoize)
  const setQuickReconnect = useConnectionStore((s) => s.setQuickReconnect)
  const resetProfile = useConnectionStore((s) => s.resetProfile)

  const locked = isLocked(status)
  const masque = usesMasque(profile.protocol)

  return (
    <div className="scroll-slim flex flex-1 flex-col gap-5 overflow-y-auto px-[18px] pt-[18px] pb-6">
      <Section title="Protocol">
        <div
          role="radiogroup"
          aria-label="Protocol"
          className="flex flex-col gap-1.5"
        >
          {PROTOCOLS.map((p) => (
            <RadioCard
              key={p}
              selected={profile.protocol === p}
              disabled={locked}
              name={PROTOCOL_LABEL[p]}
              description={PROTOCOL_DESC[p]}
              onSelect={() => setProtocol(p)}
            />
          ))}
        </div>
      </Section>

      <Section title="Scan mode" hint="faster → more certain">
        <Segmented
          label="Scan mode"
          disabled={locked}
          value={profile.scan_mode}
          onChange={setScanMode}
          options={SCANS.map((s) => ({ value: s, label: SCAN_LABEL[s] }))}
        />
        <Note>{SCAN_DESC[profile.scan_mode]}</Note>
      </Section>

      <div className="grid grid-cols-2 gap-4">
        <Section title="IP version">
          <Segmented
            label="IP version"
            disabled={locked}
            value={profile.ip_version}
            onChange={setIpVersion}
            options={IPS.map((v) => ({ value: v, label: IP_LABEL[v] }))}
          />
        </Section>
        <Section title="Transport">
          <Segmented
            label="MASQUE transport"
            disabled={locked || !masque}
            value={profile.masque_http2 ? "http2" : "http3"}
            onChange={(v) => setMasqueHttp2(v === "http2")}
            options={[
              { value: "http3", label: "HTTP/3" },
              { value: "http2", label: "HTTP/2" },
            ]}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-[var(--neutral-600)]">
            {masque
              ? "HTTP/2 works where UDP is blocked."
              : "MASQUE only — ignored by WireGuard."}
          </p>
        </Section>
      </div>

      <Section title="Obfuscation">
        <div
          role="radiogroup"
          aria-label="Obfuscation"
          className="flex items-center gap-1.5"
        >
          {masque
            ? MASQUE_NOIZES.map((n) => (
                <Chip
                  key={n}
                  selected={profile.masque_noize === n}
                  disabled={locked}
                  label={MASQUE_NOIZE_LABEL[n]}
                  onSelect={() => setMasqueNoize(n)}
                />
              ))
            : WG_NOIZES.map((n) => (
                <Chip
                  key={n}
                  selected={profile.wg_noize === n}
                  disabled={locked}
                  label={WG_NOIZE_LABEL[n]}
                  onSelect={() => setWgNoize(n)}
                />
              ))}
        </div>
        <Note>
          {masque
            ? MASQUE_NOIZE_DESC[profile.masque_noize]
            : WG_NOIZE_DESC[profile.wg_noize]}
        </Note>
      </Section>

      <ToggleRow
        title="Quick reconnect"
        description="Re-test the last working gateway before scanning again."
      >
        <Switch
          checked={profile.quick_reconnect}
          onCheckedChange={setQuickReconnect}
          disabled={locked}
          aria-label="Quick reconnect"
        />
      </ToggleRow>

      <Section title="SOCKS5 proxy">
        <BindAddressField />
      </Section>

      <Section title="Zero Trust">
        <ZeroTrustSettings />
      </Section>

      <Section title="DNS & routing">
        <RoutingSettings />
      </Section>

      <CloseToTrayToggle />

      <div className="flex items-center gap-2 pt-0.5">
        <span className="text-[11.5px] text-faint">
          Changes apply on next connect.
        </span>
        <button
          type="button"
          onClick={resetProfile}
          disabled={locked}
          className="ml-auto rounded-md px-1 py-0.5 text-xs text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
