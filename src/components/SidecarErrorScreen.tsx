import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  message: string;
  onRetry: () => void;
}

/** Full-screen fallback shown when the bundled Aether binary itself can't
 * run — structurally different from a normal connection error, since the
 * connect button would be meaningless to show at all in this state. */
export function SidecarErrorScreen({ message, onRetry }: Props) {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle size={40} className="text-status-error" />
      <h1 className="text-base font-medium text-foreground">{t.sidecarError.title}</h1>
      <p className="max-w-xs font-mono text-xs text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        {t.sidecarError.retry}
      </Button>
    </div>
  );
}
