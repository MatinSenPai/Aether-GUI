import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "default" | "cyberpunk" | "matrix" | "synthwave" | "ice";

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "default",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "aether-theme-storage",
    }
  )
);
