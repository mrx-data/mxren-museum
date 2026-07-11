import "./styles.css";
import { artifacts as sampleArtifacts, categories, type Artifact, type ArtifactCategory } from "./collection";
import {
  clearStoredAdminSession,
  createRemoteArtifact,
  deleteRemoteArtifact,
  getRemoteUser,
  isRemoteAdmin,
  isSupabaseConfigured,
  loadManagedArtifacts,
  loadLocalArtifacts,
  onRemoteAuthChange,
  queryArtifacts,
  signInRemoteUser,
  signOutRemoteUser,
  updateRemoteArtifact,
  type ArtifactFormInput,
  type GalleryImageInput,
  type ManagedArtifact,
  type PersistenceMode
} from "./artifact-store";
import {
  animateCollectionRefresh,
  animateArtifactDialog,
  animateArtifactDialogClose,
  animateMuseumRoute,
  initMuseumMotion,
  playMuseumEntry,
  refreshMuseumScrollAnimations
} from "./museum-motion";
import { initMuseumCanvas } from "./museum-canvas";

type FilterId = "all" | ArtifactCategory;
type MuseumRoute = "home" | "collection" | "manage";
type AccessRole = "locked" | "guest" | "admin";

interface RouteState {
  route: MuseumRoute;
  targetId: string;
}

const routeTitles: Record<MuseumRoute, string> = {
  home: "mxren-museum | 私人数字藏馆",
  collection: "馆藏目录 | mxren-museum",
  manage: "藏品管理 | mxren-museum"
};

const ACCESS_MODE_STORAGE_KEY = "mxren-museum.access-mode.v1";

let activeFilter: FilterId = "all";
let searchQuery = "";
let dialogClosing = false;
let managedArtifacts: ManagedArtifact[] = loadLocalArtifacts();
let persistenceMode: PersistenceMode = isSupabaseConfigured() ? "supabase" : "local";
let adminSession: Awaited<ReturnType<typeof getRemoteUser>> = null;
let accessRole: AccessRole = loadStoredAccessRole();
let isCheckingAdminRole = false;
let adminRoleError = "";
let gateAdminFormOpen = false;
let editingArtifactId: string | null = null;
let pendingCoverImage = "";
let pendingCoverFile: File | null = null;
let pendingGalleryImages: GalleryImageInput[] = [];
let pendingGalleryFiles: File[] = [];
let activeRouteState: RouteState | null = null;
let activeHash = "";
let motionRefreshFrame = 0;
let searchDebounceTimer = 0;
let renderedAccessRole: AccessRole | null = null;
const basePath = ((import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/").replace(/\/?$/, "/");

const accessGate = document.querySelector<HTMLElement>("#access-gate");
const gateGuestAccess = document.querySelector<HTMLButtonElement>("#gate-guest-access");
const gateAdminToggle = document.querySelector<HTMLButtonElement>("#gate-admin-toggle");
const gateAuthForm = document.querySelector<HTMLFormElement>("#gate-auth-form");
const gateAuthEmail = document.querySelector<HTMLInputElement>("#gate-auth-email");
const gateAuthPassword = document.querySelector<HTMLInputElement>("#gate-auth-password");
const gateAuthStatus = document.querySelector<HTMLElement>("#gate-auth-status");
const appShell = document.querySelector<HTMLElement>("#app");
const artifactCount = document.querySelector<HTMLElement>("#artifact-count");
const categoryCount = document.querySelector<HTMLElement>("#category-count");
const heroStageGallery = document.querySelector<HTMLElement>("#hero-stage-gallery");
const heroStageCaption = document.querySelector<HTMLElement>("#hero-stage-caption");
const featuredGallery = document.querySelector<HTMLElement>("#featured-gallery");
const categoryIndex = document.querySelector<HTMLElement>("#category-index");
const filterBar = document.querySelector<HTMLElement>("#filter-bar");
const collectionGrid = document.querySelector<HTMLElement>("#collection-grid");
const dialog = document.querySelector<HTMLDialogElement>("#artifact-dialog");
const dialogBody = document.querySelector<HTMLElement>("#dialog-body");
const dialogClose = document.querySelector<HTMLButtonElement>(".dialog-close");
const artifactSearch = document.querySelector<HTMLInputElement>("#artifact-search");
const artifactForm = document.querySelector<HTMLFormElement>("#artifact-form");
const artifactFormHeading = document.querySelector<HTMLElement>("#artifact-form-heading");
const artifactFormId = document.querySelector<HTMLInputElement>("#artifact-form-id");
const artifactFormTitle = document.querySelector<HTMLInputElement>("#artifact-form-title");
const artifactFormCategory = document.querySelector<HTMLSelectElement>("#artifact-form-category");
const artifactFormYear = document.querySelector<HTMLInputElement>("#artifact-form-year");
const artifactFormMedium = document.querySelector<HTMLInputElement>("#artifact-form-medium");
const artifactFormRarity = document.querySelector<HTMLInputElement>("#artifact-form-rarity");
const artifactFormSummary = document.querySelector<HTMLTextAreaElement>("#artifact-form-summary");
const artifactFormNote = document.querySelector<HTMLTextAreaElement>("#artifact-form-note");
const artifactFormFeatured = document.querySelector<HTMLInputElement>("#artifact-form-featured");
const artifactCoverUpload = document.querySelector<HTMLInputElement>("#artifact-cover-upload");
const artifactGalleryUpload = document.querySelector<HTMLInputElement>("#artifact-gallery-upload");
const artifactCoverPreview = document.querySelector<HTMLElement>("#artifact-cover-preview");
const artifactGalleryPreview = document.querySelector<HTMLElement>("#artifact-gallery-preview");
const artifactManagerList = document.querySelector<HTMLElement>("#artifact-manager-list");
const artifactManagerListTitle = document.querySelector<HTMLElement>("#manager-list-title");
const artifactManagerStatus = document.querySelector<HTMLElement>("#artifact-manager-status");
const artifactFormReset = document.querySelector<HTMLButtonElement>("#artifact-form-reset");
const authSignOut = document.querySelector<HTMLButtonElement>("#auth-sign-out");
const authStatus = document.querySelector<HTMLElement>("#auth-status");
const pageElements = Array.from(document.querySelectorAll<HTMLElement>("[data-page]"));
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".site-nav [data-nav-route]"));
const routeLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));

function accessStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function loadStoredAccessRole(): AccessRole {
  return accessStorage()?.getItem(ACCESS_MODE_STORAGE_KEY) === "guest" ? "guest" : "locked";
}

function storeGuestAccess() {
  accessStorage()?.setItem(ACCESS_MODE_STORAGE_KEY, "guest");
}

function clearStoredAccess() {
  accessStorage()?.removeItem(ACCESS_MODE_STORAGE_KEY);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character] ?? character;
  });
}

function setCoverStyle(element: HTMLElement, artifact: Artifact) {
  element.style.setProperty("--cover-from", artifact.palette.from);
  element.style.setProperty("--cover-via", artifact.palette.via);
  element.style.setProperty("--cover-to", artifact.palette.to);
  element.style.setProperty("--cover-accent", artifact.palette.accent);
}

function createImageElement(src: string, alt: string, loading: "eager" | "lazy" = "lazy", highPriority = false) {
  const image = document.createElement("img");
  image.src = resolveAssetSrc(src);
  image.alt = alt;
  image.loading = loading;
  image.decoding = "async";
  if (highPriority) image.setAttribute("fetchpriority", "high");
  return image;
}

function resolveAssetSrc(src: string) {
  const trimmedSrc = src.trim();
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(trimmedSrc) || !trimmedSrc.startsWith("/")) {
    return src;
  }

  return `${basePath}${trimmedSrc.replace(/^\/+/, "")}`;
}

function isArtifactCategory(value: string): value is ArtifactCategory {
  return value === "games" || value === "landscapes" || value === "personal-works";
}

function routeFromHash(hash = window.location.hash): RouteState {
  const target = hash.replace(/^#\/?/, "") || "home";

  if (target === "collection") {
    return { route: "collection", targetId: "collection" };
  }

  if (target === "manage") {
    return { route: "manage", targetId: "manage" };
  }

  if (target === "featured" || target === "notes") {
    return { route: "home", targetId: target };
  }

  return { route: "home", targetId: "top" };
}

function normalizedCurrentHash() {
  return window.location.hash || "#home";
}

function sameRouteState(first: RouteState | null, second: RouteState) {
  return first?.route === second.route && first.targetId === second.targetId;
}

function scheduleMuseumScrollRefresh(skipSection?: HTMLElement) {
  if (motionRefreshFrame) return;

  motionRefreshFrame = requestAnimationFrame(() => {
    motionRefreshFrame = 0;
    refreshMuseumScrollAnimations(skipSection);
  });
}

function scrollToRouteTarget(target: HTMLElement, smooth: boolean) {
  const headerOffset = document.querySelector<HTMLElement>(".site-header")?.offsetHeight ?? 0;
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset - 20);
  window.scrollTo({ top, behavior: smooth ? "smooth" : "instant" as ScrollBehavior });
}

function setActiveNavigation({ route, targetId }: RouteState) {
  navLinks.forEach((link) => {
    const isCurrent = link.dataset.navRoute === route && link.dataset.navTarget === targetId;
    link.classList.toggle("is-active", isCurrent);

    if (isCurrent) {
      link.setAttribute("aria-current", route === "home" && targetId !== "top" ? "location" : "page");
      return;
    }

    link.removeAttribute("aria-current");
  });
}

function showRoutePage(routeState: RouteState, shouldScroll = true, shouldRefreshMotion = true, hash = normalizedCurrentHash()) {
  const routeChanged = activeRouteState?.route !== routeState.route;
  const needsMotionRefresh = shouldRefreshMotion && (activeRouteState === null || routeChanged);

  activeRouteState = routeState;
  activeHash = hash;

  document.body.dataset.route = routeState.route;
  document.title = routeTitles[routeState.route];

  pageElements.forEach((element) => {
    element.hidden = element.dataset.page !== routeState.route;
  });

  setActiveNavigation(routeState);

  const target = document.getElementById(routeState.targetId);
  const routeSection = target?.closest<HTMLElement>("[data-motion-section]") ?? target;

  if (target && shouldScroll) {
    scrollToRouteTarget(target, !routeChanged);
  }

  if (needsMotionRefresh) {
    refreshMuseumScrollAnimations(routeSection ?? undefined);
    if (routeSection) animateMuseumRoute(routeSection);
  }
}

function syncRouteFromHash(shouldScroll = true, shouldRefreshMotion = true) {
  if (accessRole === "locked") return;

  const hash = normalizedCurrentHash();
  const routeState = routeFromHash(hash);

  if (hash === activeHash && sameRouteState(activeRouteState, routeState)) {
    return;
  }

  showRoutePage(routeState, shouldScroll, shouldRefreshMotion, hash);
}

function navigateToHash(hash: string) {
  const normalizedHash = hash.startsWith("#") ? hash : `#${hash}`;
  const routeState = routeFromHash(normalizedHash);

  if (normalizedCurrentHash() !== normalizedHash) {
    history.pushState({ route: routeState.route, targetId: routeState.targetId }, "", normalizedHash);
  }

  showRoutePage(routeState, true, true, normalizedHash);
}

export function mergeArtifacts(samples: Artifact[], managed: ManagedArtifact[]) {
  const managedById = new Map(managed.map((artifact) => [artifact.id, artifact]));
  const sampleIds = new Set(samples.map((artifact) => artifact.id));
  return [
    ...samples.map((artifact) => managedById.get(artifact.id) ?? artifact),
    ...managed.filter((artifact) => !sampleIds.has(artifact.id) && !artifact.sourceArtifactId)
  ];
}

function allArtifacts() {
  return mergeArtifacts(sampleArtifacts, managedArtifacts);
}

function artifactNumber(index: number) {
  return `No.${String(Math.max(index, 0) + 1).padStart(3, "0")}`;
}

function showManagerStatus(message: string, tone: "neutral" | "success" | "danger" = "neutral") {
  if (!artifactManagerStatus) return;
  artifactManagerStatus.textContent = message;
  artifactManagerStatus.dataset.tone = tone;
}

function showAuthStatus(message: string, tone: "neutral" | "success" | "danger" = "neutral") {
  if (!authStatus) return;
  authStatus.textContent = message;
  authStatus.dataset.tone = tone;
}

function showGateStatus(message: string, tone: "neutral" | "success" | "danger" = "neutral") {
  if (!gateAuthStatus) return;
  gateAuthStatus.textContent = message;
  gateAuthStatus.dataset.tone = tone;
}

function canManageArtifacts() {
  return accessRole === "admin" && Boolean(adminSession) && persistenceMode === "supabase";
}

function authStatusMessage() {
  if (accessRole === "locked") return { message: "等待入馆", tone: "neutral" as const };
  if (isCheckingAdminRole) return { message: "正在核验管理员", tone: "neutral" as const };
  if (adminRoleError) return { message: adminRoleError, tone: "danger" as const };
  if (accessRole === "admin") return { message: `管理员：${adminSession?.displayName ?? "admin"}`, tone: "success" as const };
  return { message: "游客只读", tone: "neutral" as const };
}

function managerAccessStatus() {
  if (accessRole === "locked") {
    return { message: "等待入馆", tone: "neutral" as const };
  }

  if (!isSupabaseConfigured()) {
    return { message: "游客只读", tone: "neutral" as const };
  }

  if (persistenceMode !== "supabase") {
    return { message: "云端不可用，只读", tone: "danger" as const };
  }

  if (canManageArtifacts()) {
    return { message: "管理员可编辑", tone: "success" as const };
  }

  if (adminSession) {
    return { message: "非管理员只读", tone: "danger" as const };
  }

  return { message: "游客只读", tone: "neutral" as const };
}

function setManagementControlsDisabled() {
  if (!artifactForm) return;

  const canManage = canManageArtifacts();
  artifactForm.hidden = !canManage;
  artifactForm
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
      "input, select, textarea, button"
    )
    .forEach((control) => {
      control.disabled = !canManage;
    });
}

function renderAuthState(updateManagerStatus = true) {
  const isLocked = accessRole === "locked";
  const isUnlockTransition = renderedAccessRole === "locked" && !isLocked;
  renderedAccessRole = accessRole;

  document.body.dataset.accessRole = accessRole;

  if (accessGate) {
    accessGate.hidden = !isLocked;
  }

  if (appShell) {
    if (isLocked) {
      appShell.setAttribute("aria-hidden", "true");
    } else {
      appShell.removeAttribute("aria-hidden");
    }
    (appShell as HTMLElement & { inert?: boolean }).inert = isLocked;
  }

  if (gateAuthForm && gateAdminToggle) {
    gateAuthForm.hidden = !isLocked || !gateAdminFormOpen;
    gateAdminToggle.setAttribute("aria-expanded", String(isLocked && gateAdminFormOpen));
    gateAdminToggle.disabled = !isSupabaseConfigured();
    gateAuthEmail?.toggleAttribute("disabled", !isLocked || !gateAdminFormOpen || !isSupabaseConfigured());
    gateAuthPassword?.toggleAttribute("disabled", !isLocked || !gateAdminFormOpen || !isSupabaseConfigured());
  }

  if (authSignOut) {
    authSignOut.hidden = isLocked;
    authSignOut.textContent = accessRole === "admin" ? "退出管理员" : "切换身份";
  }

  const authStatus = authStatusMessage();
  showAuthStatus(authStatus.message, authStatus.tone);
  setManagementControlsDisabled();

  if (updateManagerStatus) {
    const managerStatus = managerAccessStatus();
    showManagerStatus(managerStatus.message, managerStatus.tone);
  }

  renderManagerList();

  if (isLocked) {
    activeRouteState = null;
    activeHash = "";
    document.title = "进入藏馆 | mxren-museum";
    showGateStatus(isSupabaseConfigured() ? "请选择入馆身份" : "Supabase 未配置，游客仍可入馆");
    return;
  }

  syncRouteFromHash(true, false);
  if (isUnlockTransition) {
    const hero = document.querySelector<HTMLElement>("[data-motion-hero]");
    refreshMuseumScrollAnimations(hero ?? undefined);
    playMuseumEntry();
    return;
  }
  scheduleMuseumScrollRefresh();
}

function refreshMuseumView() {
  updateCounts();
  renderHeroStage();
  renderFeatured();
  renderCategoryIndex();
  renderFilters();
  renderCollection();
  renderManagerList();
  scheduleMuseumScrollRefresh();
}

async function syncRemoteAccess(session: Awaited<ReturnType<typeof getRemoteUser>>) {
  adminSession = session;
  adminRoleError = "";

  if (!adminSession) {
    accessRole = loadStoredAccessRole();
    isCheckingAdminRole = false;
    renderAuthState();
    return;
  }

  accessRole = "guest";
  isCheckingAdminRole = true;
  gateAdminFormOpen = false;
  renderAuthState();

  try {
    const hasAdminSession = await isRemoteAdmin(adminSession);
    accessRole = hasAdminSession ? "admin" : "guest";
    clearStoredAccess();
    if (hasAdminSession) {
      showGateStatus("管理员已入馆", "success");
    } else {
      await signOutRemoteUser(adminSession);
      adminSession = null;
      showGateStatus("管理员会话已失效，已以游客身份入馆", "danger");
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    adminRoleError = `管理员核验失败：${detail}`;
    adminSession = null;
    clearStoredAdminSession();
    accessRole = "guest";
    showGateStatus(adminRoleError, "danger");
  } finally {
    isCheckingAdminRole = false;
    renderAuthState();
  }
}

async function refreshRemoteUser() {
  await syncRemoteAccess(await getRemoteUser());
}

async function hydrateManagedArtifacts() {
  showManagerStatus(isSupabaseConfigured() ? "正在连接 Supabase" : "browser-local storage");
  const result = await loadManagedArtifacts();
  persistenceMode = result.mode;
  managedArtifacts = result.artifacts;
  showManagerStatus(result.message, result.error ? "danger" : result.mode === "supabase" ? "success" : "neutral");
  refreshMuseumView();
  await refreshRemoteUser();
}

function appendCoverImage(cover: HTMLElement, artifact: Artifact) {
  if (artifact.coverImage) {
    cover.append(createImageElement(artifact.coverImage, artifact.coverAlt));
  }
  cover.insertAdjacentHTML("beforeend", `<span class="cover-symbol" aria-hidden="true">${escapeHtml(artifact.symbol)}</span>`);
}

function artifactCard(artifact: Artifact, variant: "featured" | "standard", sequenceIndex: number) {
  const article = document.createElement("article");
  article.className = `artifact-card poster-work corner-flourish ${variant === "featured" ? "is-featured" : ""}`;
  article.setAttribute("data-motion-item", variant);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "artifact-button";
  button.setAttribute("aria-label", `打开 ${artifact.title} 的藏品详情`);
  button.addEventListener("click", () => openArtifactDialog(artifact));

  const cover = document.createElement("div");
  cover.className = "artifact-cover arch-top sepia-reveal";
  cover.setAttribute("data-motion-image", "");
  cover.setAttribute("role", "img");
  cover.setAttribute("aria-label", artifact.coverAlt);
  setCoverStyle(cover, artifact);
  appendCoverImage(cover, artifact);

  const body = document.createElement("div");
  body.className = "artifact-body";
  body.innerHTML = `
    <div class="poster-card-topline">
      <span>${escapeHtml(artifactNumber(sequenceIndex))}</span>
      <span>细赏</span>
    </div>
    <p class="artifact-volume">Volume ${escapeHtml(artifact.volume)}</p>
    <h3>${escapeHtml(artifact.title)}</h3>
    <p class="artifact-meta">${escapeHtml(artifact.categoryLabel)} · ${escapeHtml(artifact.year)}</p>
    <p>${escapeHtml(artifact.summary)}</p>
    <dl class="poster-specs">
      <div><dt>媒介</dt><dd>${escapeHtml(artifact.medium)}</dd></div>
      <div><dt>标记</dt><dd>${escapeHtml(artifact.rarity)}</dd></div>
    </dl>
  `;

  if (artifact.featured) {
    const seal = document.createElement("span");
    seal.className = "wax-seal";
    seal.setAttribute("aria-label", artifact.rarity);
    seal.textContent = "★";
    button.append(seal);
  }

  button.append(cover, body);
  article.append(button);
  return article;
}

function renderHeroStage() {
  if (!heroStageGallery || !heroStageCaption) return;

  const stagedArtifacts = allArtifacts().filter((artifact) => artifact.featured).slice(0, 4);
  if (stagedArtifacts.length === 0) return;

  heroStageGallery.replaceChildren(
    ...stagedArtifacts.map((artifact, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `stage-card ${index === 0 ? "is-front" : ""}`;
      button.setAttribute("aria-label", `打开 ${artifact.title} 的藏品详情`);
      button.style.setProperty("--stage-index", String(index));
      setCoverStyle(button, artifact);
      button.addEventListener("click", () => openArtifactDialog(artifact));

      if (artifact.coverImage) {
        button.append(createImageElement(artifact.coverImage, artifact.coverAlt, "eager", index === 0));
      }
      button.insertAdjacentHTML("beforeend", `<span class="cover-symbol" aria-hidden="true">${escapeHtml(artifact.symbol)}</span>`);
      return button;
    })
  );

  const lead = stagedArtifacts[0];
  heroStageCaption.innerHTML = `
    <span>展厅 ${escapeHtml(String(stagedArtifacts.length).padStart(2, "0"))}</span>
    <strong>${escapeHtml(lead.title)}</strong>
    <small>${escapeHtml(lead.categoryLabel)} · ${escapeHtml(lead.year)}</small>
  `;
}

function renderCategoryIndex() {
  if (!categoryIndex) return;

  const artifacts = allArtifacts();
  categoryIndex.replaceChildren(
    ...categories.filter((category) => category.id !== "all").map((category, index) => {
      const count = artifacts.filter((artifact) => artifact.category === category.id).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-ticket";
      button.setAttribute("aria-pressed", String(activeFilter === category.id));
      button.setAttribute("data-motion-item", "category");
      button.innerHTML = `
        <span class="category-number">CAT.${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(category.label)}</strong>
        <span>${String(count).padStart(2, "0")} 件藏品</span>
        <span aria-hidden="true">→</span>
      `;
      button.addEventListener("click", () => {
        activeFilter = category.id;
        renderCategoryIndex();
        renderFilters();
        renderCollection(true);
        collectionGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return button;
    })
  );
}

export function renderFilters() {
  if (!filterBar) return;
  filterBar.replaceChildren();

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.dataset.filter = category.id;
    button.setAttribute("data-motion-filter", category.id);
    button.textContent = category.label;
    button.setAttribute("aria-pressed", String(activeFilter === category.id));
    button.addEventListener("click", () => {
      activeFilter = category.id;
      renderCategoryIndex();
      renderFilters();
      renderCollection(true);
    });
    filterBar.append(button);
  });
}

export function renderCollection(animate = false) {
  if (!collectionGrid) return;

  const artifacts = allArtifacts();
  const artifactOrder = new Map(artifacts.map((artifact, index) => [artifact.id, index]));
  const visibleArtifacts = queryArtifacts(artifacts, searchQuery, activeFilter);
  collectionGrid.replaceChildren(
    ...visibleArtifacts.map((artifact) => artifactCard(artifact, "standard", artifactOrder.get(artifact.id) ?? 0))
  );
  if (animate) animateCollectionRefresh(collectionGrid);
}

function renderFeatured() {
  if (!featuredGallery) return;
  const artifacts = allArtifacts();
  const artifactOrder = new Map(artifacts.map((artifact, index) => [artifact.id, index]));
  const featured = artifacts.filter((artifact) => artifact.featured);
  featuredGallery.replaceChildren(
    ...featured.map((artifact) => artifactCard(artifact, "featured", artifactOrder.get(artifact.id) ?? 0))
  );
}

export function openArtifactDialog(artifact: Artifact) {
  if (!dialog || !dialogBody) return;
  dialogClosing = false;

  const cover = document.createElement("div");
  cover.className = "dialog-cover arch-top sepia-reveal";
  cover.setAttribute("data-motion-image", "");
  cover.setAttribute("role", "img");
  cover.setAttribute("aria-label", artifact.coverAlt);
  setCoverStyle(cover, artifact);
  appendCoverImage(cover, artifact);

  const copy = document.createElement("div");
  copy.className = "dialog-copy";
  copy.innerHTML = `
    <p class="volume-label">Volume ${escapeHtml(artifact.volume)}</p>
    <h2 id="dialog-title">${escapeHtml(artifact.title)}</h2>
    <dl class="artifact-ledger">
      <div><dt>类别</dt><dd>${escapeHtml(artifact.categoryLabel)}</dd></div>
      <div><dt>年份</dt><dd>${escapeHtml(artifact.year)}</dd></div>
      <div><dt>媒介</dt><dd>${escapeHtml(artifact.medium)}</dd></div>
      <div><dt>标记</dt><dd>${escapeHtml(artifact.rarity)}</dd></div>
    </dl>
    <p class="dialog-summary">${escapeHtml(artifact.summary)}</p>
    <p>${escapeHtml(artifact.note)}</p>
  `;

  copy.querySelectorAll(".artifact-ledger div").forEach((item) => {
    item.setAttribute("data-motion-ledger", "");
  });

  const imageStrip = document.createElement("div");
  imageStrip.className = "dialog-image-strip";
  imageStrip.setAttribute("aria-label", `${artifact.title} 图片组`);
  setCoverStyle(imageStrip, artifact);
  artifact.galleryImages.forEach((galleryImage) => {
    const plate = document.createElement("figure");
    plate.className = "image-plate";
    plate.setAttribute("data-motion-item", "dialog-gallery");

    const image = createImageElement(galleryImage.src, galleryImage.alt);
    image.setAttribute("data-motion-image", "");
    plate.append(image);

    const caption = document.createElement("figcaption");
    caption.textContent = galleryImage.label;
    plate.append(caption);
    imageStrip.append(plate);
  });
  copy.insertBefore(imageStrip, copy.querySelector(".dialog-summary"));

  dialogBody.replaceChildren(cover, copy);
  dialog.showModal();
  animateArtifactDialog(dialog);
}

export function closeArtifactDialog() {
  if (!dialog?.open || dialogClosing) return;

  dialogClosing = true;
  animateArtifactDialogClose(dialog, () => {
    dialog.close();
    dialogClosing = false;
  });
}

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Invalid image file"));
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Invalid image result"));
    });
    reader.addEventListener("error", () => reject(new Error("Image read failed")));
    reader.readAsDataURL(file);
  });
}

function renderUploadPreviews() {
  artifactCoverPreview?.replaceChildren();
  artifactGalleryPreview?.replaceChildren();

  if (artifactCoverPreview && pendingCoverImage) {
    const image = createImageElement(pendingCoverImage, "封面图片预览");
    artifactCoverPreview.append(image);
  }

  if (artifactGalleryPreview) {
    pendingGalleryImages.forEach((galleryImage) => {
      const figure = document.createElement("figure");
      const image = createImageElement(galleryImage.src, galleryImage.alt ?? "详情图片预览");
      const caption = document.createElement("figcaption");
      caption.textContent = galleryImage.label ?? "详情";
      figure.append(image, caption);
      artifactGalleryPreview.append(figure);
    });
  }
}

async function handleCoverUpload(event: Event) {
  if (!requireManageAccess("上传封面")) return;

  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    pendingCoverFile = file;
    pendingCoverImage = await readImageFileAsDataUrl(file);
    renderUploadPreviews();
    showManagerStatus("封面已载入", "success");
  } catch {
    showManagerStatus("图片读取失败，请换一张图片", "danger");
  }
}

async function handleGalleryUpload(event: Event) {
  if (!requireManageAccess("上传详情图片")) return;

  const input = event.currentTarget as HTMLInputElement;
  const files = Array.from(input.files ?? []).slice(0, 3);
  if (files.length === 0) return;

  try {
    pendingGalleryFiles = files;
    const sources = await Promise.all(files.map((file) => readImageFileAsDataUrl(file)));
    const title = artifactFormTitle?.value.trim() || "本地藏品";
    pendingGalleryImages = sources.map((src, index) => ({
      src,
      alt: `${title} 的详情图片 ${index + 1}`,
      label: ["细节", "记忆", "图板"][index] ?? `图 ${index + 1}`
    }));
    renderUploadPreviews();
    showManagerStatus("详情图片已载入", "success");
  } catch {
    showManagerStatus("图片读取失败，请换一张图片", "danger");
  }
}

async function handleGateAdminSubmit(event: SubmitEvent) {
  event.preventDefault();
  const username = gateAuthEmail?.value.trim() ?? "";
  const password = gateAuthPassword?.value ?? "";

  if (!username || !password) {
    showGateStatus("请输入管理员账号和密码", "danger");
    return;
  }

  try {
    showGateStatus("正在登录");
    clearStoredAccess();
    await syncRemoteAccess(await signInRemoteUser(username, password));
    if (gateAuthPassword) gateAuthPassword.value = "";
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    accessRole = "locked";
    adminRoleError = "";
    renderAuthState(false);
    showGateStatus(`登录失败：${detail}`, "danger");
  }
}

async function handleSwitchIdentity() {
  try {
    if (adminSession) {
      await signOutRemoteUser(adminSession);
    }
    adminSession = null;
    accessRole = "locked";
    adminRoleError = "";
    isCheckingAdminRole = false;
    gateAdminFormOpen = false;
    clearStoredAccess();
    resetArtifactForm(false);
    renderAuthState();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    showAuthStatus(`退出失败：${detail}`, "danger");
  }
}

async function handleGateGuestAccess() {
  adminRoleError = "";

  if (adminSession) {
    await signOutRemoteUser(adminSession);
    adminSession = null;
  }

  accessRole = "guest";
  gateAdminFormOpen = false;
  isCheckingAdminRole = false;
  storeGuestAccess();
  resetArtifactForm(false);
  showGateStatus("游客已入馆", "success");
  renderAuthState();
}

function handleGateAdminToggle() {
  gateAdminFormOpen = !gateAdminFormOpen;
  renderAuthState();
  if (gateAdminFormOpen) {
    gateAuthEmail?.focus();
  }
}

function bindAuthEvents() {
  gateGuestAccess?.addEventListener("click", () => {
    void handleGateGuestAccess();
  });
  gateAdminToggle?.addEventListener("click", handleGateAdminToggle);
  gateAuthForm?.addEventListener("submit", (event) => {
    void handleGateAdminSubmit(event);
  });
  authSignOut?.addEventListener("click", () => {
    void handleSwitchIdentity();
  });
  onRemoteAuthChange((session) => {
    void syncRemoteAccess(session);
  });
}

function requireManageAccess(action: string) {
  if (canManageArtifacts()) return true;

  renderAuthState(false);

  if (accessRole === "locked") {
    showGateStatus(`请先入馆，再${action}`, "danger");
    gateGuestAccess?.focus();
    return false;
  }

  if (!adminSession) {
    showManagerStatus(`请切换为管理员身份，再${action}`, "danger");
    return false;
  }

  if (persistenceMode !== "supabase") {
    showManagerStatus("云端不可用，暂时只能查看藏品", "danger");
    return false;
  }

  showManagerStatus(`当前账号不是管理员，不能${action}`, "danger");
  return false;
}

function artifactFormInput(): ArtifactFormInput | null {
  const title = artifactFormTitle?.value.trim() ?? "";
  const category = artifactFormCategory?.value ?? "";

  if (!title) {
    showManagerStatus("请输入藏品标题", "danger");
    artifactFormTitle?.focus();
    return null;
  }

  if (!isArtifactCategory(category)) {
    showManagerStatus("请选择藏品类别", "danger");
    artifactFormCategory?.focus();
    return null;
  }

  return {
    id: artifactFormId?.value || undefined,
    title,
    category,
    year: artifactFormYear?.value.trim() ?? "",
    medium: artifactFormMedium?.value.trim() ?? "",
    rarity: artifactFormRarity?.value.trim() ?? "",
    featured: artifactFormFeatured?.checked ?? false,
    coverImage: pendingCoverImage,
    coverAlt: `${title} 的藏品封面`,
    coverFile: pendingCoverFile,
    galleryImages: pendingGalleryImages,
    galleryFiles: pendingGalleryFiles,
    summary: artifactFormSummary?.value.trim() ?? "",
    note: artifactFormNote?.value.trim() ?? ""
  };
}

function resetArtifactForm(updateStatus = true) {
  artifactForm?.reset();
  if (artifactFormId) artifactFormId.value = "";
  editingArtifactId = null;
  pendingCoverImage = "";
  pendingCoverFile = null;
  pendingGalleryImages = [];
  pendingGalleryFiles = [];
  if (artifactFormHeading) artifactFormHeading.textContent = "新增藏品";
  renderUploadPreviews();
  if (updateStatus) {
    const managerStatus = managerAccessStatus();
    showManagerStatus(managerStatus.message, managerStatus.tone);
  }
}

export async function handleArtifactSubmit(event: SubmitEvent) {
  event.preventDefault();
  if (!requireManageAccess("保存藏品")) return;

  const input = artifactFormInput();
  if (!input) return;

  try {
    const successMessage = editingArtifactId ? "藏品已更新" : "藏品已保存";
    if (persistenceMode === "supabase" && adminSession) {
      if (editingArtifactId) {
        const managedArtifact = managedArtifacts.find((artifact) => artifact.id === editingArtifactId);
        if (managedArtifact) {
          const updated = await updateRemoteArtifact(editingArtifactId, input, managedArtifacts, adminSession);
          managedArtifacts = managedArtifacts.map((artifact) => (artifact.id === editingArtifactId ? updated : artifact));
        } else {
          const sampleArtifact = sampleArtifacts.find((artifact) => artifact.id === editingArtifactId);
          if (!sampleArtifact) throw new Error("找不到要修改的藏品");
          const created = await createRemoteArtifact(input, allArtifacts(), adminSession, {
            sourceArtifactId: sampleArtifact.id,
            volume: sampleArtifact.volume,
            palette: sampleArtifact.palette,
            symbol: sampleArtifact.symbol
          });
          managedArtifacts = [...managedArtifacts, created];
        }
      } else {
        const created = await createRemoteArtifact(input, allArtifacts(), adminSession);
        managedArtifacts = [...managedArtifacts, created];
      }
    } else {
      showManagerStatus("云端不可用，暂时只能查看藏品", "danger");
      return;
    }

    resetArtifactForm();
    showManagerStatus(successMessage, "success");
    refreshMuseumView();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    showManagerStatus(`藏品未保存：${detail}`, "danger");
  }
}

export function handleArtifactEdit(id: string) {
  if (!requireManageAccess("修改藏品")) return;

  const artifact = allArtifacts().find((item) => item.id === id);
  if (!artifact) return;

  editingArtifactId = artifact.id;
  pendingCoverImage = artifact.coverImage;
  pendingCoverFile = null;
  pendingGalleryImages = artifact.galleryImages.map((image) => ({ ...image }));
  pendingGalleryFiles = [];

  if (artifactFormId) artifactFormId.value = artifact.id;
  if (artifactFormTitle) artifactFormTitle.value = artifact.title;
  if (artifactFormCategory) artifactFormCategory.value = artifact.category;
  if (artifactFormYear) artifactFormYear.value = artifact.year;
  if (artifactFormMedium) artifactFormMedium.value = artifact.medium;
  if (artifactFormRarity) artifactFormRarity.value = artifact.rarity;
  if (artifactFormSummary) artifactFormSummary.value = artifact.summary;
  if (artifactFormNote) artifactFormNote.value = artifact.note;
  if (artifactFormFeatured) artifactFormFeatured.checked = artifact.featured;
  if (artifactFormHeading) artifactFormHeading.textContent = "修改藏品";

  renderUploadPreviews();
  showManagerStatus(`正在修改：${artifact.title}`);
  artifactForm?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export async function handleArtifactDelete(id: string) {
  if (!requireManageAccess("删除藏品")) return;
  if (!adminSession) return;

  const artifact = managedArtifacts.find((item) => item.id === id);
  if (!artifact) return;

  const restoresSample = Boolean(artifact.sourceArtifactId);
  const confirmation = restoresSample
    ? `恢复藏品「${artifact.title}」为内置版本？`
    : `删除藏品「${artifact.title}」？`;
  if (!globalThis.confirm(confirmation)) return;

  try {
    if (artifact.source === "remote" && persistenceMode === "supabase") {
      await deleteRemoteArtifact(artifact.remoteId ?? id, adminSession);
      managedArtifacts = managedArtifacts.filter((item) => item.id !== id);
    } else {
      showManagerStatus("云端不可用，暂时只能查看藏品", "danger");
      return;
    }

    if (editingArtifactId === id) resetArtifactForm();
    showManagerStatus(restoresSample ? "已恢复内置版本" : "藏品已删除", "success");
    refreshMuseumView();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    showManagerStatus(`删除失败：${detail}`, "danger");
  }
}

function renderManagerList() {
  if (!artifactManagerList) return;
  const canManage = canManageArtifacts();
  const artifacts = allArtifacts();

  if (artifactManagerListTitle) {
    artifactManagerListTitle.textContent = "全部馆藏";
  }

  if (artifacts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "manager-empty";
    empty.textContent = "还没有馆藏条目。";
    artifactManagerList.replaceChildren(empty);
    return;
  }

  artifactManagerList.replaceChildren(
    ...artifacts.map((artifact) => {
      const row = document.createElement("article");
      row.className = "manager-row";

      const copy = document.createElement("div");
      const title = document.createElement("h4");
      title.textContent = artifact.title;
      const meta = document.createElement("p");
      meta.textContent = `${artifact.categoryLabel} · ${artifact.year} · ${artifact.rarity}`;
      const source = document.createElement("span");
      source.className = "manager-source";
      source.textContent = artifact.sourceArtifactId
        ? "云端覆盖"
        : artifact.source === "remote"
          ? "云端新增"
          : artifact.source === "local"
            ? "本地回退"
            : "内置藏品";
      copy.append(title, meta, source);

      const actions = document.createElement("div");
      actions.className = "manager-actions";

      if (canManage) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "button button-secondary";
        editButton.textContent = "修改";
        editButton.setAttribute("aria-label", `修改 ${artifact.title}`);
        editButton.addEventListener("click", () => handleArtifactEdit(artifact.id));

        actions.append(editButton);
        if (artifact.source === "remote") {
          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "button button-danger";
          deleteButton.textContent = artifact.sourceArtifactId ? "恢复内置" : "删除";
          deleteButton.setAttribute(
            "aria-label",
            artifact.sourceArtifactId ? `恢复 ${artifact.title} 为内置版本` : `删除 ${artifact.title}`
          );
          deleteButton.addEventListener("click", () => {
            void handleArtifactDelete(artifact.id);
          });
          actions.append(deleteButton);
        }
        row.append(copy, actions);
        return row;
      }

      const badge = document.createElement("span");
      badge.className = "manager-readonly";
      badge.textContent = "只读";
      actions.append(badge);
      row.append(copy, actions);
      return row;
    })
  );
}

function bindDialogEvents() {
  dialogClose?.addEventListener("click", closeArtifactDialog);

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeArtifactDialog();
    }
  });

  dialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeArtifactDialog();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialog?.open) {
      closeArtifactDialog();
    }
  });
}

function bindManagementEvents() {
  artifactSearch?.addEventListener("input", () => {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      searchQuery = artifactSearch.value;
      renderCollection(true);
    }, 120);
  });
  artifactForm?.addEventListener("submit", (event) => {
    void handleArtifactSubmit(event);
  });
  artifactCoverUpload?.addEventListener("change", (event) => {
    void handleCoverUpload(event);
  });
  artifactGalleryUpload?.addEventListener("change", (event) => {
    void handleGalleryUpload(event);
  });
  artifactFormReset?.addEventListener("click", () => resetArtifactForm());
}

function bindRouteEvents() {
  routeLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href?.startsWith("#")) return;

      event.preventDefault();
      navigateToHash(href);
    });
  });

  window.addEventListener("hashchange", () => syncRouteFromHash());
  window.addEventListener("popstate", () => syncRouteFromHash());
}

function updateCounts() {
  if (artifactCount) artifactCount.textContent = String(allArtifacts().length).padStart(2, "0");
  if (categoryCount) categoryCount.textContent = String(categories.length - 1).padStart(2, "0");
}

function initMuseum() {
  initMuseumCanvas();
  updateCounts();
  renderHeroStage();
  renderFeatured();
  renderCategoryIndex();
  renderFilters();
  renderCollection();
  renderManagerList();
  renderUploadPreviews();
  renderAuthState();
  bindDialogEvents();
  bindManagementEvents();
  bindAuthEvents();
  bindRouteEvents();
  initMuseumMotion();
  void hydrateManagedArtifacts();
}

initMuseum();
