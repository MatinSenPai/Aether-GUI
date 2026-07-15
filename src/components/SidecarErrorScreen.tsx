import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  onRetry: () => void;
}

/** Full-screen fallback shown when the bundled Aether binary itself can't
 * run — structurally different from a normal connection error, since the
 * connect button would be meaningless to show at all in this state. */
export function SidecarErrorScreen({ message, onRetry }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center overflow-y-auto scrollbar-none">
      <AlertTriangle size={40} className="text-status-error shrink-0" />
      <h1 className="text-base font-medium text-foreground shrink-0">
        Aether engine failed to start
      </h1>
      <p className="max-w-xs font-mono text-xs text-muted-foreground break-all">{message}</p>
      <div className="shrink-0">
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}
