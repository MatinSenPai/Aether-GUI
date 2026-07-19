import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Info, Settings2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { ProtocolSelect } from "@/components/ProtocolSelect";
import { ScanModeToggle } from "@/components/ScanModeToggle";
import { IpVersionToggle } from "@/components/IpVersionToggle";
import { MasqueTransportToggle } from "@/components/MasqueTransportToggle";
import { useConnectionStore } from "@/state/connectionStore";
import { useLanguage } from "@/i18n/LanguageContext";
import type { AppSettings } from "@/types/connection";

export function FieldRow({
  label,
  tooltip,
  aboutLabel,
  children,
}: {
  label: string;
  tooltip?: string;
  aboutLabel: (label: string) => string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger aria-label={aboutLabel(label)}>
              <Info size={12} />
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Collapsed by default — this *is* the auto-mode default: press Connect,
 * done. Everything configurable (the options Aether's own interactive setup
 * exposes — see aether/prompts.rs and profiles.rs, nothing else) plus the
 * raw log stream live behind this one disclosure.
 *
 * Deliberately animation-light: opening used to stack a Motion layout
 * spring, a 300ms tw-animate slide, an instant column reflow, and three
 * Glass filter mounts — four systems fighting read as jank. Now it's one
 * fast CSS fade/slide and nothing else.
 */
export function AdvancedPanel() {
  const logs = useConnectionStore((s) => s.logs);
  const status = useConnectionStore((s) => s.status);
  const quickReconnect = useConnectionStore((s) => s.profile.quick_reconnect);
  const setQuickReconnect = useConnectionStore((s) => s.setQuickReconnect);
  const localPort = useConnectionStore((s) => s.profile.local_port);
  const setLocalPort = useConnectionStore((s) => s.setLocalPort);
  const lanAccessEnabled = useConnectionStore((s) => s.profile.lan_access_enabled);
  const setLanAccessEnabled = useConnectionStore((s) => s.setLanAccessEnabled);
  const lanPort = useConnectionStore((s) => s.profile.lan_port);
  const setLanPort = useConnectionStore((s) => s.setLanPort);
  const { t } = useLanguage();
  const [portDraft, setPortDraft] = useState(String(localPort));
  const [lanPortDraft, setLanPortDraft] = useState(lanPort === null ? "" : String(lanPort));
  // Fetched once regardless of whether LAN access is on yet, so the hint
  // ("Other devices can connect to …") is ready the instant the user flips
  // the switch instead of popping in a beat later.
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // Logs get their own accordion, independent of `open` above — collapsing
  // it must never touch the Advanced panel's own open/closed state, and
  // vice versa. Starts closed: the log stream is the one thing here that's
  // rarely needed, so it shouldn't push everything else down by default.
  const [logsOpen, setLogsOpen] = useState(false);
  // Launch flag — locked mid-session like the other profile controls.
  const locked = status.state !== "Idle" && status.state !== "Error";
  const [autoScroll, setAutoScroll] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Startup/tray settings live in their own Rust-side store (settings.rs) and
  // the autostart plugin's own OS registration — independent of the
  // connection profile above, so they're loaded/saved separately here rather
  // than through connectionStore.
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    invoke<AppSettings>("get_app_settings")
      .then(setAppSettings)
      .catch((e) => console.error("Failed to load app settings:", e));
  }, []);

  useEffect(() => {
    invoke<string | null>("get_lan_ip")
      .then(setLanIp)
      .catch((e) => console.error("Failed to resolve LAN IP:", e));
  }, []);

  function updateAppSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
    command: string,
  ) {
    const previous = appSettings;
    setAppSettings((s) => (s ? { ...s, [key]: value } : s));
    invoke(command, { enabled: value }).catch((e) => {
      console.error(`Failed to update ${key}:`, e);
      setAppSettings(previous); // revert the optimistic toggle on failure
    });
  }

  useEffect(() => {
    if (autoScroll && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Radix's CollapsibleContent unmounts the viewport while closed, so
  // reopening needs its own scroll-to-bottom rather than relying on the
  // effect above (whose deps won't have changed just because it remounted).
  useEffect(() => {
    if (logsOpen && autoScroll && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [logsOpen, autoScroll]);

  useEffect(() => {
    setPortDraft(String(localPort));
  }, [localPort]);

  useEffect(() => {
    setLanPortDraft(lanPort === null ? "" : String(lanPort));
  }, [lanPort]);

  function commitPortDraft() {
    const parsed = Number(portDraft);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
      setLocalPort(parsed);
    } else {
      setPortDraft(String(localPort)); // invalid entry: revert to last valid value
    }
  }

  // Empty is a valid, meaningful value here ("use Local Port") — only an
  // actually-typed-but-out-of-range number gets reverted.
  function commitLanPortDraft() {
    if (lanPortDraft.trim() === "") {
      setLanPort(null);
      return;
    }
    const parsed = Number(lanPortDraft);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
      setLanPort(parsed);
    } else {
      setLanPortDraft(lanPort === null ? "" : String(lanPort)); // revert
    }
  }

  return (
    <div className="w-full max-w-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary rounded-md">
          <Settings2 size={14} />
          {t.advanced.toggle}
          <ChevronDown
            size={14}
            className="transition-transform duration-150 data-[state=open]:rotate-180"
            data-state={open ? "open" : "closed"}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1 data-[state=open]:duration-150 data-[state=open]:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100">
          <div className="flex flex-col gap-4 pb-2">
            <FieldRow
              label={t.advanced.protocol}
              tooltip={t.advanced.protocolTooltip}
              aboutLabel={t.advanced.about}
            >
              <ProtocolSelect />
            </FieldRow>
            <FieldRow label={t.advanced.scanMode} aboutLabel={t.advanced.about}>
              <ScanModeToggle />
            </FieldRow>
            <FieldRow
              label={t.advanced.ipVersion}
              tooltip={t.advanced.ipVersionTooltip}
              aboutLabel={t.advanced.about}
            >
              <IpVersionToggle />
            </FieldRow>
            <FieldRow
              label={t.advanced.masqueTransport}
              tooltip={t.advanced.masqueTransportTooltip}
              aboutLabel={t.advanced.about}
            >
              <MasqueTransportToggle />
            </FieldRow>

            <FieldRow
              label={t.advanced.localPort}
              tooltip={t.advanced.localPortTooltip}
              aboutLabel={t.advanced.about}
            >
              <input
                type="number"
                min={1}
                max={65535}
                value={portDraft}
                disabled={locked}
                onChange={(e) => setPortDraft(e.target.value)}
                onBlur={commitPortDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                aria-label={t.advanced.localPort}
                className="w-24 rounded-md bg-surface-2 px-2 py-1 text-xs text-foreground ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              />
            </FieldRow>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {t.advanced.allowLan}
                  <Tooltip>
                    <TooltipTrigger aria-label={t.advanced.about(t.advanced.allowLan)}>
                      <Info size={12} />
                    </TooltipTrigger>
                    <TooltipContent>{t.advanced.allowLanTooltip}</TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={lanAccessEnabled}
                  onCheckedChange={setLanAccessEnabled}
                  disabled={locked}
                  aria-label={t.advanced.allowLan}
                />
              </div>
              {lanAccessEnabled && (
                <div className="flex flex-col gap-1">
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={lanPortDraft}
                    disabled={locked}
                    placeholder={t.advanced.allowLanPortPlaceholder}
                    onChange={(e) => setLanPortDraft(e.target.value)}
                    onBlur={commitLanPortDraft}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    aria-label={t.advanced.allowLan}
                    className="w-32 rounded-md bg-surface-2 px-2 py-1 text-xs text-foreground ring-1 ring-white/10 outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                  />
                  {lanIp && (
                    <p className="text-[11px] text-muted-foreground">
                      {t.advanced.lanAddressHint(`${lanIp}:${lanPort ?? localPort}`)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {t.advanced.quickReconnect}
                <Tooltip>
                  <TooltipTrigger aria-label={t.advanced.about(t.advanced.quickReconnect)}>
                    <Info size={12} />
                  </TooltipTrigger>
                  <TooltipContent>{t.advanced.quickReconnectTooltip}</TooltipContent>
                </Tooltip>
              </div>
              <Switch
                checked={quickReconnect}
                onCheckedChange={setQuickReconnect}
                disabled={locked}
                aria-label={t.advanced.quickReconnect}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                {t.advanced.startupTray}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {t.advanced.launchOnStartup}
                <Tooltip>
                  <TooltipTrigger aria-label={t.advanced.about(t.advanced.launchOnStartup)}>
                    <Info size={12} />
                  </TooltipTrigger>
                  <TooltipContent>{t.advanced.launchOnStartupTooltip}</TooltipContent>
                </Tooltip>
              </div>
              <Switch
                checked={appSettings?.launch_on_startup ?? false}
                onCheckedChange={(v) =>
                  updateAppSetting("launch_on_startup", v, "set_launch_on_startup")
                }
                disabled={appSettings === null}
                aria-label={t.advanced.launchOnStartup}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {t.advanced.startMinimized}
                <Tooltip>
                  <TooltipTrigger aria-label={t.advanced.about(t.advanced.startMinimized)}>
                    <Info size={12} />
                  </TooltipTrigger>
                  <TooltipContent>{t.advanced.startMinimizedTooltip}</TooltipContent>
                </Tooltip>
              </div>
              <Switch
                checked={appSettings?.start_minimized ?? false}
                onCheckedChange={(v) => updateAppSetting("start_minimized", v, "set_start_minimized")}
                disabled={appSettings === null}
                aria-label={t.advanced.startMinimized}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {t.advanced.autoConnect}
                <Tooltip>
                  <TooltipTrigger aria-label={t.advanced.about(t.advanced.autoConnect)}>
                    <Info size={12} />
                  </TooltipTrigger>
                  <TooltipContent>{t.advanced.autoConnectTooltip}</TooltipContent>
                </Tooltip>
              </div>
              <Switch
                checked={appSettings?.auto_connect ?? false}
                onCheckedChange={(v) => updateAppSetting("auto_connect", v, "set_auto_connect")}
                disabled={appSettings === null}
                aria-label={t.advanced.autoConnect}
              />
            </div>

            <Collapsible open={logsOpen} onOpenChange={setLogsOpen} className="flex flex-col gap-2">
              <CollapsibleTrigger className="flex w-full items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md group">
                <div className="h-px flex-1 bg-border" />
                <span className="flex items-center gap-1 text-[10px] tracking-wide text-muted-foreground uppercase group-hover:text-foreground">
                  {t.advanced.logs}{logs.length > 0 && ` (${logs.length})`}
                  <ChevronDown
                    size={12}
                    className="transition-transform duration-150 data-[state=open]:rotate-180"
                    data-state={logsOpen ? "open" : "closed"}
                  />
                </span>
                <div className="h-px flex-1 bg-border" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-150 data-[state=open]:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100">
                <div
                  ref={viewportRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
                  }}
                  className="max-h-64 overflow-y-auto rounded-md bg-black/20 p-2 font-mono text-xs text-muted-foreground ring-1 ring-white/10"
                >
                  {logs.length === 0 ? (
                    <p className="text-status-idle">{t.advanced.noOutput}</p>
                  ) : (
                    logs.map((l, i) => <p key={i}>{l.line}</p>)
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
