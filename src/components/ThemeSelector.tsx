import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useThemeStore, type ThemeName } from "@/state/themeStore";

export function ThemeSelector() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as ThemeName)}>
      <SelectTrigger aria-label="Select app theme">
        <SelectValue placeholder="Select a theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Default (Orange)</SelectItem>
        <SelectItem value="cyberpunk">Cyberpunk (Yellow)</SelectItem>
        <SelectItem value="matrix">Matrix (Green)</SelectItem>
        <SelectItem value="synthwave">Synthwave (Pink)</SelectItem>
        <SelectItem value="ice">Ice (Cyan)</SelectItem>
      </SelectContent>
    </Select>
  );
}
