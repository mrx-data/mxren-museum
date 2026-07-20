export type MuseumTheme = "academia" | "scroll" | "observatory";

export const MUSEUM_THEME_STORAGE_KEY = "mxren-museum.theme.v1";

const themeMetadata: Record<MuseumTheme, { label: string; color: string }> = {
  academia: { label: "暗金藏馆", color: "#1C1714" },
  scroll: { label: "丹青卷宗", color: "#D8CFB5" },
  observatory: { label: "极夜观测所", color: "#071018" }
};

let transitionTimer = 0;

function isMuseumTheme(value: string | undefined): value is MuseumTheme {
  return value === "academia" || value === "scroll" || value === "observatory";
}

function storedMuseumTheme(): MuseumTheme {
  const preset = document.documentElement.dataset.theme;
  if (isMuseumTheme(preset)) return preset;
  try {
    const saved = localStorage.getItem(MUSEUM_THEME_STORAGE_KEY) ?? undefined;
    if (isMuseumTheme(saved)) return saved;
  } catch {
    // Storage can be unavailable in hardened or private browser contexts.
  }
  return "academia";
}

function announceTheme(theme: MuseumTheme) {
  const status = document.querySelector<HTMLElement>("#theme-status");
  if (status) status.textContent = `已切换为${themeMetadata[theme].label}`;
}

export function applyMuseumTheme(theme: MuseumTheme, persist = true, announce = false) {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.clearTimeout(transitionTimer);
  if (!reduceMotion) root.classList.add("theme-transitioning");
  root.dataset.theme = theme;

  const selector = document.querySelector<HTMLSelectElement>("#museum-theme");
  if (selector) selector.value = theme;
  const themeColor = document.querySelector<HTMLMetaElement>("#theme-color");
  if (themeColor) themeColor.content = themeMetadata[theme].color;

  if (persist) {
    try {
      localStorage.setItem(MUSEUM_THEME_STORAGE_KEY, theme);
    } catch {
      // The visual theme still applies for the current visit.
    }
  }
  if (announce) announceTheme(theme);
  document.dispatchEvent(new CustomEvent("museum-theme-change", { detail: { theme } }));

  transitionTimer = window.setTimeout(() => root.classList.remove("theme-transitioning"), 620);
}

export function initMuseumTheme() {
  const selector = document.querySelector<HTMLSelectElement>("#museum-theme");
  const initialTheme = storedMuseumTheme();
  applyMuseumTheme(initialTheme, false);
  selector?.addEventListener("change", () => {
    if (isMuseumTheme(selector.value)) applyMuseumTheme(selector.value, true, true);
  });
}
