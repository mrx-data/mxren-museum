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

function syncThemePicker(theme: MuseumTheme) {
  const selector = document.querySelector<HTMLSelectElement>("#museum-theme");
  const trigger = document.querySelector<HTMLButtonElement>("#museum-theme-trigger");
  const label = document.querySelector<HTMLElement>("#museum-theme-label");
  selector && (selector.value = theme);
  if (label) label.textContent = themeMetadata[theme].label;
  trigger?.setAttribute("aria-label", `选择藏馆主题：${themeMetadata[theme].label}`);
  document.querySelectorAll<HTMLButtonElement>("[data-theme-option]").forEach((option) => {
    const selected = option.dataset.themeOption === theme;
    option.setAttribute("aria-selected", String(selected));
    const state = option.querySelector<HTMLElement>(".theme-option-state");
    if (state) state.textContent = selected ? "已启用" : "选择";
  });
}

export function applyMuseumTheme(theme: MuseumTheme, persist = true, announce = false) {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.clearTimeout(transitionTimer);
  if (!reduceMotion) root.classList.add("theme-transitioning");
  root.dataset.theme = theme;

  syncThemePicker(theme);
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
  const picker = document.querySelector<HTMLElement>("[data-theme-picker]");
  const trigger = document.querySelector<HTMLButtonElement>("#museum-theme-trigger");
  const menu = document.querySelector<HTMLElement>("#museum-theme-menu");
  const options = [...document.querySelectorAll<HTMLButtonElement>("[data-theme-option]")];
  const initialTheme = storedMuseumTheme();
  applyMuseumTheme(initialTheme, false);

  const selectedOption = () => options.find((option) => option.dataset.themeOption === document.documentElement.dataset.theme);
  const closeMenu = (restoreFocus = false) => {
    if (!menu || !trigger) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    picker?.classList.remove("is-open");
    if (restoreFocus) trigger.focus();
  };
  const focusOption = (index: number) => options[(index + options.length) % options.length]?.focus();
  const openMenu = () => {
    if (!menu || !trigger) return;
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    picker?.classList.add("is-open");
    requestAnimationFrame(() => selectedOption()?.focus());
  };
  const chooseOption = (option: HTMLButtonElement) => {
    const theme = option.dataset.themeOption;
    if (isMuseumTheme(theme)) applyMuseumTheme(theme, true, true);
    closeMenu(true);
  };

  trigger?.addEventListener("click", () => {
    if (menu?.hidden) openMenu();
    else closeMenu();
  });
  trigger?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openMenu();
  });
  options.forEach((option, index) => {
    option.tabIndex = -1;
    option.addEventListener("click", () => chooseOption(option));
    option.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusOption(index + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusOption(index - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusOption(0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusOption(options.length - 1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseOption(option);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      } else if (event.key === "Tab") {
        closeMenu();
      }
    });
  });
  document.addEventListener("pointerdown", (event) => {
    if (picker && !picker.contains(event.target as Node)) closeMenu();
  });
  selector?.addEventListener("change", () => {
    if (isMuseumTheme(selector.value)) applyMuseumTheme(selector.value, true, true);
  });
}
