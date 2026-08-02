interface MuseumSelectState {
  select: HTMLSelectElement;
  control: HTMLElement;
  trigger: HTMLButtonElement;
  value: HTMLElement;
  menu: HTMLElement;
  label: string;
  observer: MutationObserver;
}

const selectStates = new Map<HTMLSelectElement, MuseumSelectState>();
const observedForms = new WeakSet<HTMLFormElement>();
let activeSelect: MuseumSelectState | null = null;
let globalEventsBound = false;

function normalizedText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function accessibleSelectLabel(select: HTMLSelectElement) {
  const explicitLabel = normalizedText(select.getAttribute("aria-label"));
  if (explicitLabel) return explicitLabel;
  const label = select.labels?.[0];
  const directLabel = normalizedText(label?.querySelector(":scope > span")?.textContent);
  return directLabel || normalizedText(label?.textContent) || "选择选项";
}

function selectedLabel(select: HTMLSelectElement) {
  return normalizedText(select.selectedOptions[0]?.textContent) || "暂无可选项";
}

function currentThemeMark() {
  if (document.documentElement.dataset.theme === "scroll") return "印";
  if (document.documentElement.dataset.theme === "observatory") return "✦";
  return "◆";
}

function closeSelect(state: MuseumSelectState, restoreFocus = false) {
  state.menu.hidden = true;
  state.trigger.setAttribute("aria-expanded", "false");
  state.control.classList.remove("is-open", "opens-up", "align-end");
  if (activeSelect === state) activeSelect = null;
  if (restoreFocus) state.trigger.focus();
}

function closeActiveSelect(restoreFocus = false) {
  if (activeSelect) closeSelect(activeSelect, restoreFocus);
}

function focusOption(state: MuseumSelectState, index: number) {
  const enabledOptions = [...state.menu.querySelectorAll<HTMLButtonElement>(".museum-select-option:not(:disabled)")];
  if (!enabledOptions.length) return;
  enabledOptions[(index + enabledOptions.length) % enabledOptions.length]?.focus();
}

function chooseOption(state: MuseumSelectState, option: HTMLOptionElement) {
  if (option.disabled) return;
  state.select.value = option.value;
  state.trigger.removeAttribute("aria-invalid");
  state.select.dispatchEvent(new Event("input", { bubbles: true }));
  state.select.dispatchEvent(new Event("change", { bubbles: true }));
  syncSelect(state);
  closeSelect(state, true);
}

function createOptionButton(state: MuseumSelectState, option: HTMLOptionElement, index: number) {
  const button = document.createElement("button");
  const selected = option.selected;
  button.type = "button";
  button.className = "museum-select-option";
  button.id = `${state.select.id}-option-${index}`;
  button.role = "option";
  button.tabIndex = -1;
  button.disabled = option.disabled;
  button.dataset.value = option.value;
  button.setAttribute("aria-selected", String(selected));

  const mark = document.createElement("span");
  mark.className = "museum-select-option-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = currentThemeMark();
  const copy = document.createElement("span");
  copy.className = "museum-select-option-copy";
  copy.textContent = normalizedText(option.textContent);
  const status = document.createElement("span");
  status.className = "museum-select-option-status";
  status.setAttribute("aria-hidden", "true");
  status.textContent = selected ? "当前" : "选择";
  button.append(mark, copy, status);

  button.addEventListener("click", () => chooseOption(state, option));
  button.addEventListener("keydown", (event) => {
    const enabledOptions = [...state.menu.querySelectorAll<HTMLButtonElement>(".museum-select-option:not(:disabled)")];
    const currentIndex = enabledOptions.indexOf(button);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(state, currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(state, currentIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(state, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(state, enabledOptions.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseOption(state, option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSelect(state, true);
    } else if (event.key === "Tab") {
      closeSelect(state);
    }
  });
  return button;
}

function syncSelect(state: MuseumSelectState) {
  const { select, control, trigger, value, menu, label } = state;
  const options = [...select.options];
  const currentLabel = selectedLabel(select);
  value.textContent = currentLabel;
  trigger.disabled = select.disabled || options.length === 0;
  trigger.setAttribute("aria-label", `${label}：${currentLabel}`);
  control.hidden = select.hidden;
  control.toggleAttribute("data-disabled", trigger.disabled);
  menu.replaceChildren(...options.map((option, index) => createOptionButton(state, option, index)));
  if (select.hidden || trigger.disabled) closeSelect(state);
}

function placeMenu(state: MuseumSelectState) {
  state.control.classList.remove("opens-up", "align-end");
  const triggerRect = state.trigger.getBoundingClientRect();
  const menuRect = state.menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth - 12) state.control.classList.add("align-end");
  if (triggerRect.bottom + menuRect.height + 16 > window.innerHeight && triggerRect.top > menuRect.height + 16) {
    state.control.classList.add("opens-up");
  }
}

function openSelect(state: MuseumSelectState) {
  if (state.trigger.disabled) return;
  if (activeSelect && activeSelect !== state) closeSelect(activeSelect);
  syncSelect(state);
  state.menu.hidden = false;
  state.trigger.setAttribute("aria-expanded", "true");
  state.control.classList.add("is-open");
  activeSelect = state;
  requestAnimationFrame(() => {
    placeMenu(state);
    const selected = state.menu.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)');
    (selected ?? state.menu.querySelector<HTMLButtonElement>(".museum-select-option:not(:disabled)"))?.focus();
  });
}

function observeSelect(state: MuseumSelectState) {
  state.observer.observe(state.select, {
    attributes: true,
    attributeFilter: ["disabled", "hidden", "label", "selected", "value", "aria-label"],
    childList: true,
    characterData: true,
    subtree: true
  });
  const form = state.select.form;
  if (form && !observedForms.has(form)) {
    observedForms.add(form);
    form.addEventListener("reset", () => requestAnimationFrame(refreshMuseumSelects));
  }
}

function enhanceSelect(select: HTMLSelectElement) {
  if (selectStates.has(select) || select.id === "museum-theme") return;
  const label = accessibleSelectLabel(select);
  const control = document.createElement("div");
  control.className = "museum-select-control";
  control.dataset.museumSelectControl = select.id;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "museum-select-trigger";
  trigger.id = `${select.id}-trigger`;
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", `${select.id}-menu`);
  const value = document.createElement("span");
  value.className = "museum-select-value";
  trigger.append(value);
  const menu = document.createElement("div");
  menu.className = "museum-select-menu";
  menu.id = `${select.id}-menu`;
  menu.role = "listbox";
  menu.setAttribute("aria-label", `${label}选项`);
  menu.hidden = true;

  select.before(control);
  control.append(select, trigger, menu);
  select.classList.add("museum-select-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  const state: MuseumSelectState = {
    select,
    control,
    trigger,
    value,
    menu,
    label,
    observer: new MutationObserver(() => syncSelect(state))
  };
  selectStates.set(select, state);

  trigger.addEventListener("click", () => {
    if (state.menu.hidden) openSelect(state);
    else closeSelect(state);
  });
  trigger.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    openSelect(state);
  });
  select.addEventListener("change", () => syncSelect(state));
  select.addEventListener("input", () => syncSelect(state));
  select.addEventListener("invalid", () => {
    trigger.setAttribute("aria-invalid", "true");
    trigger.focus();
  });
  observeSelect(state);
  syncSelect(state);
}

function bindGlobalEvents() {
  if (globalEventsBound) return;
  globalEventsBound = true;
  document.addEventListener("pointerdown", (event) => {
    if (activeSelect && !activeSelect.control.contains(event.target as Node)) closeActiveSelect();
  });
  window.addEventListener("resize", () => closeActiveSelect());
  window.addEventListener("scroll", () => closeActiveSelect(), true);
  document.addEventListener("museum-theme-change", refreshMuseumSelects);
}

export function refreshMuseumSelects() {
  selectStates.forEach(syncSelect);
}

export function initMuseumSelects() {
  document.querySelectorAll<HTMLSelectElement>("select.museum-select").forEach(enhanceSelect);
  bindGlobalEvents();
}
