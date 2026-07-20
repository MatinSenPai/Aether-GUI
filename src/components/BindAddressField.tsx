import { useConnectionStore } from "@/state/connectionStore";
import { Switch } from "@/components/ui/switch";

const DEFAULT_PORT = "1819";
const LOOPBACK = "127.0.0.1";
const ANY = "0.0.0.0";

function splitAddr(addr: string): { host: string; port: string } {
  const last = addr.lastIndexOf(":");
  if (last === -1) return { host: LOOPBACK, port: addr || DEFAULT_PORT };
  return { host: addr.slice(0, last) || LOOPBACK, port: addr.slice(last + 1) || DEFAULT_PORT };
}

export function BindAddressField() {
  const bind = useConnectionStore((s) => s.profile.bind_address);
  const setBindAddress = useConnectionStore((s) => s.setBindAddress);
  const status = useConnectionStore((s) => s.status);
  const locked = status.state !== "Idle" && status.state !== "Error";

  const { host, port } = splitAddr(bind);
  const lan = host === ANY;

  const rebuild = (h: string, p: string) => setBindAddress(`${h}:${p}`);

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        value={port}
        disabled={locked}
        onChange={(e) => {
          // Allow only digits, max 5 chars
          const v = e.target.value.replace(/\D/g, "").slice(0, 5);
          rebuild(host, v);
        }}
        onBlur={() => {
          // Clamp to valid port range on blur
          const n = Number(port);
          if (!port || n < 1 || n > 65535) rebuild(host, DEFAULT_PORT);
        }}
        className="h-8 w-20 rounded-md bg-black/20 px-2 text-center text-xs text-foreground ring-1 ring-white/10 outline-none focus:ring-primary disabled:opacity-50"
        aria-label="SOCKS5 port"
      />
      <div className="flex items-center gap-1.5">
        <Switch
          checked={lan}
          onCheckedChange={(on) => rebuild(on ? ANY : LOOPBACK, port)}
          disabled={locked}
          aria-label="Allow LAN connections"
        />
        <span className="text-xs text-muted-foreground">LAN</span>
      </div>
    </div>
  );
}
