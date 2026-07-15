import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Info, Settings2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProtocolSelect } from "@/components/ProtocolSelect";
import { ScanModeToggle } from "@/components/ScanModeToggle";
import { IpVersionToggle } from "@/components/IpVersionToggle";
import { useConnectionStore } from "@/state/connectionStore";

function FieldRow({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger aria-label={`About ${label}`}>
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

function LogsViewer() {
  const logs = useConnectionStore((s) => s.logs);
  const [autoScroll, setAutoScroll] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="overflow-hidden rounded-md border border-white/5 bg-black/10">
      <div
        ref={viewportRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
        className="logs-viewport max-h-64 overflow-y-auto p-2 font-mono text-xs text-muted-foreground"
      >
        {logs.length === 0 ? (
          <p className="text-status-idle">No output yet.</p>
        ) : (
          logs.map((l) => <p key={l.id}>{l.line}</p>)
        )}
      </div>
    </div>
  );
}

/**
 * Collapsed by default — this *is* the auto-mode default: press Connect,
 * done. The collapsible uses Radix's native CSS animation via data-state
 * attributes instead of a JS animation library.
 *
 * All glass-surface effects have been replaced with plain CSS borders and
 * backgrounds to eliminate the cost of backdrop-filter / compositing layers.
 */
export function AdvancedPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full max-w-sm mx-auto sm:max-w-none">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary rounded-md">
          <Settings2 size={14} />
          Advanced
          <ChevronDown
            size={14}
            className="transition-transform duration-200 data-[state=open]:rotate-180"
            data-state={open ? "open" : "closed"}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1 data-[state=open]:duration-300 data-[state=open]:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-2 data-[state=closed]:duration-150">
          <div className="flex flex-col gap-4 pb-2">
          <FieldRow
            label="Protocol"
            tooltip="MASQUE disguises traffic as normal HTTPS — best against strict censorship. WireGuard is lighter and faster. gool nests two WireGuard tunnels for extra security at a speed cost."
          >
            <ProtocolSelect />
          </FieldRow>
          <FieldRow label="Scan Mode">
            <ScanModeToggle />
          </FieldRow>
          <FieldRow
            label="IP Version"
            tooltip="Which address families to search for working routes. IPv4 is the safest default on most networks."
          >
            <IpVersionToggle />
          </FieldRow>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
              Logs
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Plain border surface — no Glass/liquid-glass, no backdrop-filter (expensive) */}
          <LogsViewer />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
