import "./styles.css";
import {
  artifacts as sampleArtifacts,
  categories as defaultCategories,
  type Artifact,
  type ArtifactCategory,
  type ArtifactVisibility
} from "./collection";
import {
  clearStoredAdminSession,
  createRemoteArtifact,
  deleteRemoteArtifact,
  getRemoteUser,
  isRemoteAdmin,
  isSupabaseConfigured,
  loadArtifactCategories,
  loadHiddenSourceArtifactIds,
  loadManagedArtifacts,
  loadLocalArtifacts,
  loadRemoteArtifactById,
  loadRemoteTrash,
  normalizeArtifactTags,
  onRemoteAuthChange,
  purgeRemoteArtifact,
  queryArtifacts,
  restoreRemoteArtifact,
  signInRemoteUser,
  signOutRemoteUser,
  saveRemoteArtifactCategory,
  updateRemoteArtifact,
  type ArtifactCategoryDefinition,
  type ArtifactFormInput,
  type ArtifactSort,
  type GalleryImageInput,
  type ManagedArtifact,
  type PersistenceMode
} from "./artifact-store";
import {
  deleteMuseumExhibition,
  loadMuseumExhibitionById,
  loadMuseumExhibitions,
  normalizeExhibitionId,
  saveMuseumExhibition,
  type ExhibitionFormInput,
  type MuseumExhibition
} from "./exhibition-store";
import { createMuseumExport, downloadMuseumExport } from "./museum-export";
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
import { artifactStoragePaths, validateImageFile } from "./artifact-images";

type FilterId = "all" | ArtifactCategory;
type MuseumRoute = "home" | "exhibitions" | "collection" | "manage";
type AccessRole = "locked" | "guest" | "admin";

interface RouteState {
  route: MuseumRoute;
  targetId: string;
  artifactId?: string;
  exhibitionId?: string;
}

const routeTitles: Record<MuseumRoute, string> = {
  home: "mxren-museum | 私人数字藏馆",
  exhibitions: "策展专题 | mxren-museum",
  collection: "馆藏目录 | mxren-museum",
  manage: "藏品管理 | mxren-museum"
};

const ACCESS_MODE_STORAGE_KEY = "mxren-museum.access-mode.v1";
const NEW_CATEGORY_VALUE = "__new_category__";
const visibilityLabels: Record<ArtifactVisibility, string> = {
  draft: "草稿",
  published: "已发布",
  unlisted: "非公开"
};

let activeFilter: FilterId = "all";
let activeTag = "";
let activeYear = "";
let activeSort: ArtifactSort = "catalog";
let searchQuery = "";
let dialogClosing = false;
let managedArtifacts: ManagedArtifact[] = loadLocalArtifacts();
let hiddenSourceArtifactIds = new Set<string>();
let linkedArtifact: ManagedArtifact | null = null;
let trashedArtifacts: ManagedArtifact[] = [];
let museumExhibitions: MuseumExhibition[] = [];
let artifactCategories: Array<{ id: FilterId; label: string }> = defaultCategories.map((category) => ({ ...category }));
let persistenceMode: PersistenceMode = isSupabaseConfigured() ? "supabase" : "local";
let adminSession: Awaited<ReturnType<typeof getRemoteUser>> = null;
let accessRole: AccessRole = loadStoredAccessRole();
let isCheckingAdminRole = false;
let adminRoleError = "";
let gateAdminFormOpen = false;
let editingArtifactId: string | null = null;
let editingExhibitionId: string | null = null;
let selectedExhibitionArtifactIds: string[] = [];
let isSavingArtifact = false;
let isSavingCategory = false;
let editingCategoryId: ArtifactCategory | null = null;
let categorySelectionBeforeCreate: ArtifactCategory = "games";
let pendingCoverImage = "";
let pendingCoverFile: File | null = null;
let pendingCoverStoragePath: string | undefined;
let pendingCoverThumbnailImage: string | undefined;
let pendingCoverThumbnailStoragePath: string | undefined;
let pendingGalleryImages: GalleryImageInput[] = [];
let pendingGalleryFiles: File[] = [];
let pendingPreviewUrls: string[] = [];
let activeRouteState: RouteState | null = null;
let activeHash = "";
let activeDialogArtifactId = "";
let artifactReturnHash = "#collection";
let artifactHistoryEntryCreated = false;
let deepLinkRequestId = 0;
let motionRefreshFrame = 0;
let searchDebounceTimer = 0;
let renderedAccessRole: AccessRole | null = null;
let activeLightboxImages: Artifact["galleryImages"] = [];
let activeLightboxIndex = 0;
let lightboxTrigger: HTMLElement | null = null;
let heroStagedArtifacts: Artifact[] = [];
let heroStageActiveIndex = 0;
let heroStageAutoplayTimer = 0;
let heroStageCaptionTimer = 0;
let heroStageTransitionTimer = 0;
let heroStageAnimating = false;
let heroStageInteractionPaused = false;
const heroStageMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const HERO_STAGE_AUTOPLAY_DELAY = 6800;
const HERO_STAGE_TRANSITION_DURATION = 860;
const basePath = ((import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/").replace(/\/?$/, "/");

function hiddenSourceIdsForResult(mode: PersistenceMode, hiddenIds: string[] | null) {
  if (hiddenIds) return new Set(hiddenIds);
  return mode === "supabase"
    ? new Set(sampleArtifacts.map((artifact) => artifact.id))
    : new Set<string>();
}

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
const heroStageHost = heroStageGallery?.closest<HTMLElement>(".hero-stage-card") ?? null;
const featuredGallery = document.querySelector<HTMLElement>("#featured-gallery");
const categoryIndex = document.querySelector<HTMLElement>("#category-index");
const exhibitionGrid = document.querySelector<HTMLElement>("#exhibition-grid");
const exhibitionIndexView = document.querySelector<HTMLElement>("#exhibition-index-view");
const exhibitionDetailView = document.querySelector<HTMLElement>("#exhibition-detail-view");
const filterBar = document.querySelector<HTMLElement>("#filter-bar");
const tagFilterBar = document.querySelector<HTMLElement>("#tag-filter-bar");
const collectionGrid = document.querySelector<HTMLElement>("#collection-grid");
const collectionResultCount = document.querySelector<HTMLElement>("#collection-result-count");
const dialog = document.querySelector<HTMLDialogElement>("#artifact-dialog");
const dialogBody = document.querySelector<HTMLElement>("#dialog-body");
const dialogClose = document.querySelector<HTMLButtonElement>(".dialog-close");
const imageLightbox = document.querySelector<HTMLDialogElement>("#image-lightbox");
const imageLightboxImage = document.querySelector<HTMLImageElement>("#image-lightbox-image");
const imageLightboxCaption = document.querySelector<HTMLElement>("#image-lightbox-caption");
const imageLightboxCounter = document.querySelector<HTMLElement>("#image-lightbox-counter");
const imageLightboxClose = document.querySelector<HTMLButtonElement>(".image-lightbox-close");
const imageLightboxPrevious = document.querySelector<HTMLButtonElement>(".image-lightbox-prev");
const imageLightboxNext = document.querySelector<HTMLButtonElement>(".image-lightbox-next");
const artifactSearch = document.querySelector<HTMLInputElement>("#artifact-search");
const artifactYearFilter = document.querySelector<HTMLSelectElement>("#artifact-year-filter");
const artifactSort = document.querySelector<HTMLSelectElement>("#artifact-sort");
const artifactFilterReset = document.querySelector<HTMLButtonElement>("#artifact-filter-reset");
const artifactForm = document.querySelector<HTMLFormElement>("#artifact-form");
const artifactFormHeading = document.querySelector<HTMLElement>("#artifact-form-heading");
const artifactFormId = document.querySelector<HTMLInputElement>("#artifact-form-id");
const artifactFormTitle = document.querySelector<HTMLInputElement>("#artifact-form-title");
const artifactFormCategory = document.querySelector<HTMLSelectElement>("#artifact-form-category");
const artifactCategoryEdit = document.querySelector<HTMLButtonElement>("#artifact-category-edit");
const artifactCategoryEditor = document.querySelector<HTMLElement>("#artifact-category-editor");
const artifactCategoryName = document.querySelector<HTMLInputElement>("#artifact-category-name");
const artifactCategorySave = document.querySelector<HTMLButtonElement>("#artifact-category-save");
const artifactCategoryCancel = document.querySelector<HTMLButtonElement>("#artifact-category-cancel");
const artifactFormYear = document.querySelector<HTMLInputElement>("#artifact-form-year");
const artifactFormDate = document.querySelector<HTMLInputElement>("#artifact-form-date");
const artifactFormTags = document.querySelector<HTMLInputElement>("#artifact-form-tags");
const artifactFormMedium = document.querySelector<HTMLInputElement>("#artifact-form-medium");
const artifactFormRarity = document.querySelector<HTMLInputElement>("#artifact-form-rarity");
const artifactFormSummary = document.querySelector<HTMLTextAreaElement>("#artifact-form-summary");
const artifactFormNote = document.querySelector<HTMLTextAreaElement>("#artifact-form-note");
const artifactFormFeatured = document.querySelector<HTMLInputElement>("#artifact-form-featured");
const artifactVisibilityInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="visibility"]')
);
const artifactCoverUpload = document.querySelector<HTMLInputElement>("#artifact-cover-upload");
const artifactGalleryUpload = document.querySelector<HTMLInputElement>("#artifact-gallery-upload");
const artifactCoverPreview = document.querySelector<HTMLElement>("#artifact-cover-preview");
const artifactGalleryPreview = document.querySelector<HTMLElement>("#artifact-gallery-preview");
const artifactManagerList = document.querySelector<HTMLElement>("#artifact-manager-list");
const artifactManagerListTitle = document.querySelector<HTMLElement>("#manager-list-title");
const artifactManagerStatus = document.querySelector<HTMLElement>("#artifact-manager-status");
const museumExportJson = document.querySelector<HTMLButtonElement>("#museum-export-json");
const artifactTrashToggle = document.querySelector<HTMLButtonElement>("#artifact-trash-toggle");
const artifactTrashCount = document.querySelector<HTMLElement>("#artifact-trash-count");
const artifactTrashPanel = document.querySelector<HTMLElement>("#artifact-trash-panel");
const artifactTrashList = document.querySelector<HTMLElement>("#artifact-trash-list");
const artifactSaveButton = document.querySelector<HTMLButtonElement>("#artifact-save-button");
const artifactFormReset = document.querySelector<HTMLButtonElement>("#artifact-form-reset");
const artifactSaveError = document.querySelector<HTMLDialogElement>("#artifact-save-error");
const artifactSaveErrorTitle = document.querySelector<HTMLElement>("#save-error-title");
const artifactSaveErrorMessage = document.querySelector<HTMLElement>("#save-error-message");
const artifactSaveErrorClose = document.querySelector<HTMLButtonElement>(".save-error-close");
const artifactSaveErrorConfirm = document.querySelector<HTMLButtonElement>("#save-error-confirm");
const authSignOut = document.querySelector<HTMLButtonElement>("#auth-sign-out");
const authStatus = document.querySelector<HTMLElement>("#auth-status");
const exhibitionForm = document.querySelector<HTMLFormElement>("#exhibition-form");
const exhibitionFormTitle = document.querySelector<HTMLInputElement>("#exhibition-form-title");
const exhibitionFormId = document.querySelector<HTMLInputElement>("#exhibition-form-id");
const exhibitionFormSummary = document.querySelector<HTMLTextAreaElement>("#exhibition-form-summary");
const exhibitionFormNote = document.querySelector<HTMLTextAreaElement>("#exhibition-form-note");
const exhibitionVisibilityInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="exhibition-visibility"]')
);
const exhibitionArtifactOptions = document.querySelector<HTMLElement>("#exhibition-artifact-options");
const exhibitionArtifactOrder = document.querySelector<HTMLOListElement>("#exhibition-artifact-order");
const exhibitionReset = document.querySelector<HTMLButtonElement>("#exhibition-reset");
const exhibitionManagerList = document.querySelector<HTMLElement>("#exhibition-manager-list");
const exhibitionManagerStatus = document.querySelector<HTMLElement>("#exhibition-manager-status");
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
  return artifactCategories.some((category) => category.id !== "all" && category.id === value);
}

function routeFromHash(hash = window.location.hash): RouteState {
  const target = hash.replace(/^#\/?/, "") || "home";
  const artifactMatch = target.match(/^artifact\/(.+)$/);
  const exhibitionMatch = target.match(/^exhibition\/(.+)$/);

  if (artifactMatch) {
    let artifactId = artifactMatch[1];
    try {
      artifactId = decodeURIComponent(artifactId);
    } catch {
      artifactId = "";
    }
    const backgroundRoute = activeRouteState?.route ?? "collection";
    const backgroundTarget = activeRouteState?.targetId ?? "collection";
    return { route: backgroundRoute, targetId: backgroundTarget, artifactId };
  }

  if (exhibitionMatch) {
    let exhibitionId = exhibitionMatch[1];
    try {
      exhibitionId = decodeURIComponent(exhibitionId);
    } catch {
      exhibitionId = "";
    }
    return { route: "exhibitions", targetId: "exhibitions", exhibitionId };
  }

  if (target === "exhibitions") {
    return { route: "exhibitions", targetId: "exhibitions" };
  }

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
  return (
    first?.route === second.route &&
    first.targetId === second.targetId &&
    first.artifactId === second.artifactId &&
    first.exhibitionId === second.exhibitionId
  );
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
    void syncArtifactDialogForRoute(routeState);
    void syncExhibitionForRoute(routeState);
    return;
  }

  showRoutePage(routeState, shouldScroll, shouldRefreshMotion, hash);
  void syncArtifactDialogForRoute(routeState);
  void syncExhibitionForRoute(routeState);
}

function navigateToHash(hash: string) {
  const normalizedHash = hash.startsWith("#") ? hash : `#${hash}`;
  const routeState = routeFromHash(normalizedHash);

  if (normalizedCurrentHash() !== normalizedHash) {
    history.pushState({ route: routeState.route, targetId: routeState.targetId }, "", normalizedHash);
  }

  showRoutePage(routeState, true, true, normalizedHash);
  void syncArtifactDialogForRoute(routeState);
  void syncExhibitionForRoute(routeState);
}

function artifactHash(id: string) {
  return `#artifact/${encodeURIComponent(id)}`;
}

function artifactShareUrl(id: string) {
  return new URL(`${basePath}${artifactHash(id)}`, window.location.origin).href;
}

function exhibitionHash(id: string) {
  return `#exhibition/${encodeURIComponent(id)}`;
}

function navigateToExhibition(exhibition: MuseumExhibition) {
  navigateToHash(exhibitionHash(exhibition.id));
}

function navigateToArtifact(artifact: Artifact) {
  artifactReturnHash = normalizedCurrentHash().startsWith("#artifact/") ? "#collection" : normalizedCurrentHash();
  artifactHistoryEntryCreated = true;
  const hash = artifactHash(artifact.id);
  history.pushState({ artifactId: artifact.id }, "", hash);
  syncRouteFromHash(false, false);
}

export function mergeArtifacts(
  samples: Artifact[],
  managed: ManagedArtifact[],
  hiddenSourceIds: ReadonlySet<string> = new Set()
) {
  const managedById = new Map(managed.map((artifact) => [artifact.id, artifact]));
  const sampleIds = new Set(samples.map((artifact) => artifact.id));
  return [
    ...samples
      .filter((artifact) => managedById.has(artifact.id) || !hiddenSourceIds.has(artifact.id))
      .map((artifact) => {
        const override = managedById.get(artifact.id);
        if (!override) return artifact;
        return {
          ...override,
          tags: override.tags.length ? override.tags : artifact.tags,
          artifactDate: override.artifactDate ?? artifact.artifactDate
        };
      }),
    ...managed.filter((artifact) => !sampleIds.has(artifact.id) && !artifact.sourceArtifactId)
  ];
}

function allArtifacts() {
  const categoryLabels = new Map(artifactCategories.map((category) => [category.id, category.label]));
  return mergeArtifacts(sampleArtifacts, managedArtifacts, hiddenSourceArtifactIds).map((artifact) => {
    const currentLabel = categoryLabels.get(artifact.category);
    return currentLabel && currentLabel !== artifact.categoryLabel
      ? { ...artifact, categoryLabel: currentLabel }
      : artifact;
  });
}

function browsableArtifacts() {
  return allArtifacts().filter((artifact) => artifact.visibility === "published");
}

function artifactForDeepLink(id: string) {
  const artifact =
    allArtifacts().find((candidate) => candidate.id === id) ??
    (linkedArtifact?.id === id ? linkedArtifact : null);
  if (artifact?.visibility === "draft" && accessRole !== "admin") return null;
  return artifact;
}

function mergeArtifactCategories(definitions: ArtifactCategoryDefinition[], artifacts: Artifact[]) {
  const categoriesById = new Map<ArtifactCategory, ArtifactCategoryDefinition>();
  definitions.forEach((category) => categoriesById.set(category.id, category));
  artifacts.forEach((artifact) => {
    if (!categoriesById.has(artifact.category)) {
      categoriesById.set(artifact.category, { id: artifact.category, label: artifact.categoryLabel });
    }
  });
  artifactCategories = [
    { id: "all", label: "全部馆藏" },
    ...Array.from(categoriesById.values())
  ];
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
  const canManage = canManageArtifacts();
  if (artifactForm) artifactForm.hidden = !canManage;
  artifactForm
    ?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
      "input, select, textarea, button"
    )
    .forEach((control) => {
      control.disabled = !canManage || isSavingArtifact || isSavingCategory;
    });
  exhibitionForm
    ?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
      "input, select, textarea, button"
    )
    .forEach((control) => {
      control.disabled = !canManage;
    });

  if (artifactCategoryEdit) {
    artifactCategoryEdit.disabled =
      !canManage || isSavingArtifact || isSavingCategory || !isArtifactCategory(artifactFormCategory?.value ?? "");
  }
}

function setArtifactSavingState(saving: boolean) {
  isSavingArtifact = saving;
  artifactForm?.setAttribute("aria-busy", String(saving));

  if (artifactSaveButton) {
    artifactSaveButton.dataset.saving = String(saving);
    artifactSaveButton.setAttribute("aria-busy", String(saving));
    artifactSaveButton.setAttribute("aria-label", saving ? "正在保存藏品" : "保存藏品");
  }

  setManagementControlsDisabled();
}

function showArtifactSaveError(detail: string, title = "藏品未保存") {
  if (!artifactSaveError || !artifactSaveErrorMessage) return;

  if (artifactSaveErrorTitle) artifactSaveErrorTitle.textContent = title;
  artifactSaveErrorMessage.textContent = detail;
  if (!artifactSaveError.open) artifactSaveError.showModal();
  artifactSaveErrorConfirm?.focus();
}

function closeArtifactSaveError() {
  if (!artifactSaveError?.open) return;

  artifactSaveError.close();
  artifactSaveButton?.focus({ preventScroll: true });
}

function renderArtifactCategoryOptions(selectedCategory = artifactFormCategory?.value ?? categorySelectionBeforeCreate) {
  if (!artifactFormCategory) return;

  const options = artifactCategories
    .filter((category) => category.id !== "all")
    .map((category) => new Option(category.label, category.id));
  options.push(new Option("＋ 新增类别…", NEW_CATEGORY_VALUE));
  artifactFormCategory.replaceChildren(...options);

  if (isArtifactCategory(selectedCategory)) {
    artifactFormCategory.value = selectedCategory;
    categorySelectionBeforeCreate = selectedCategory;
  } else {
    artifactFormCategory.value = NEW_CATEGORY_VALUE;
  }
  setManagementControlsDisabled();
}

function closeCategoryEditor(restorePreviousSelection = false) {
  if (artifactCategoryEditor) artifactCategoryEditor.hidden = true;
  if (artifactCategoryName) artifactCategoryName.value = "";
  editingCategoryId = null;
  if (restorePreviousSelection) renderArtifactCategoryOptions(categorySelectionBeforeCreate);
}

function openCategoryEditor(categoryId: ArtifactCategory | null) {
  if (!artifactCategoryEditor || !artifactCategoryName) return;

  editingCategoryId = categoryId;
  const category = artifactCategories.find((item) => item.id === categoryId);
  artifactCategoryName.value = category?.label ?? "";
  if (artifactCategorySave) artifactCategorySave.textContent = categoryId ? "保存修改" : "新增类别";
  artifactCategoryEditor.hidden = false;
  artifactCategoryName.focus();
}

function setCategorySavingState(saving: boolean) {
  isSavingCategory = saving;
  artifactCategoryEditor?.setAttribute("aria-busy", String(saving));
  if (artifactCategorySave) artifactCategorySave.textContent = saving ? "正在保存" : editingCategoryId ? "保存修改" : "新增类别";
  setManagementControlsDisabled();
}

async function handleCategorySave() {
  if (!requireManageAccess("保存类别") || !adminSession || isSavingCategory) return;

  const label = artifactCategoryName?.value.trim() ?? "";
  if (!label || label.length > 40) {
    showManagerStatus("类别名称需为 1 至 40 个字符", "danger");
    artifactCategoryName?.focus();
    return;
  }

  const duplicate = artifactCategories.find(
    (category) => category.id !== editingCategoryId && category.label.toLocaleLowerCase() === label.toLocaleLowerCase()
  );
  if (duplicate) {
    showManagerStatus("已存在同名类别", "danger");
    artifactCategoryName?.focus();
    return;
  }

  const generatedId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const categoryId = editingCategoryId ?? `custom-${generatedId}`;
  const wasEditing = Boolean(editingCategoryId);

  setCategorySavingState(true);
  try {
    const savedCategory = await saveRemoteArtifactCategory(categoryId, label, adminSession);
    const existingIndex = artifactCategories.findIndex((category) => category.id === savedCategory.id);
    if (existingIndex >= 0) {
      artifactCategories[existingIndex] = savedCategory;
    } else {
      artifactCategories.push(savedCategory);
    }
    managedArtifacts = managedArtifacts.map((artifact) =>
      artifact.category === savedCategory.id ? { ...artifact, categoryLabel: savedCategory.label } : artifact
    );
    categorySelectionBeforeCreate = savedCategory.id;
    closeCategoryEditor();
    renderArtifactCategoryOptions(savedCategory.id);
    refreshMuseumView();
    showManagerStatus(wasEditing ? "类别已更新" : "类别已新增", "success");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    showManagerStatus(`类别未保存：${detail}`, "danger");
    showArtifactSaveError(detail, "类别未保存");
  } finally {
    setCategorySavingState(false);
  }
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
  renderTrash();
  renderExhibitionEditor();
  renderExhibitionManagerList();
  renderExhibitions();

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
  renderExhibitions();
  renderCategoryIndex();
  renderFilters();
  renderCatalogFacets();
  renderCollection();
  renderManagerList();
  renderTrash();
  renderExhibitionEditor();
  renderExhibitionManagerList();
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

async function reloadManagedArtifactData(session: Awaited<ReturnType<typeof getRemoteUser>>) {
  const [result, hiddenIds, exhibitions, trash] = await Promise.all([
    loadManagedArtifacts(undefined, session),
    loadHiddenSourceArtifactIds(),
    loadMuseumExhibitions(session),
    session ? loadRemoteTrash(session).catch(() => []) : Promise.resolve([])
  ]);
  persistenceMode = result.mode;
  managedArtifacts = result.artifacts;
  hiddenSourceArtifactIds = hiddenSourceIdsForResult(result.mode, hiddenIds);
  museumExhibitions = exhibitions;
  trashedArtifacts = trash;
  mergeArtifactCategories(
    artifactCategories.filter((category): category is ArtifactCategoryDefinition => category.id !== "all"),
    mergeArtifacts(sampleArtifacts, managedArtifacts, hiddenSourceArtifactIds)
  );
  showManagerStatus(result.message, result.error ? "danger" : result.mode === "supabase" ? "success" : "neutral");
  refreshMuseumView();
  return result;
}

async function hydrateManagedArtifacts() {
  showManagerStatus(isSupabaseConfigured() ? "正在连接 Supabase" : "browser-local storage");
  const storedSession = await getRemoteUser();
  const [result, loadedCategories, hiddenIds, exhibitions] = await Promise.all([
    loadManagedArtifacts(undefined, storedSession),
    loadArtifactCategories(),
    loadHiddenSourceArtifactIds(),
    loadMuseumExhibitions(storedSession)
  ]);
  persistenceMode = result.mode;
  managedArtifacts = result.artifacts;
  hiddenSourceArtifactIds = hiddenSourceIdsForResult(result.mode, hiddenIds);
  museumExhibitions = exhibitions;
  mergeArtifactCategories(
    loadedCategories,
    mergeArtifacts(sampleArtifacts, managedArtifacts, hiddenSourceArtifactIds)
  );
  renderArtifactCategoryOptions();
  showManagerStatus(result.message, result.error ? "danger" : result.mode === "supabase" ? "success" : "neutral");
  refreshMuseumView();
  await syncRemoteAccess(storedSession);
}

function appendCoverImage(cover: HTMLElement, artifact: Artifact, useThumbnail = false) {
  const source = useThumbnail ? artifact.coverThumbnailImage ?? artifact.coverImage : artifact.coverImage;
  if (source) {
    cover.append(createImageElement(source, artifact.coverAlt));
  }
}

function artifactCard(artifact: Artifact, variant: "featured" | "standard", sequenceIndex: number) {
  const article = document.createElement("article");
  article.className = `artifact-card poster-work corner-flourish ${variant === "featured" ? "is-featured" : ""}`;
  article.setAttribute("data-motion-item", variant);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "artifact-button";
  button.setAttribute("aria-label", `打开 ${artifact.title} 的藏品详情`);
  button.addEventListener("click", () => navigateToArtifact(artifact));

  const cover = document.createElement("div");
  cover.className = "artifact-cover arch-top sepia-reveal";
  cover.setAttribute("data-motion-image", "");
  cover.setAttribute("role", "img");
  cover.setAttribute("aria-label", artifact.coverAlt);
  setCoverStyle(cover, artifact);
  appendCoverImage(cover, artifact, true);

  const body = document.createElement("div");
  body.className = "artifact-body";
  body.innerHTML = `
    <div class="poster-card-topline">
      <span>${escapeHtml(artifactNumber(sequenceIndex))}</span>
      <span>细赏</span>
    </div>
    <p class="artifact-volume">Volume ${escapeHtml(artifact.volume)}</p>
    <h3>${escapeHtml(artifact.title)}</h3>
    <p class="artifact-meta">${escapeHtml(artifact.categoryLabel)} · ${escapeHtml(artifact.artifactDate ?? artifact.year)}</p>
    ${artifact.tags.length ? `<div class="artifact-tags">${artifact.tags.slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    <p>${escapeHtml(artifact.summary)}</p>
    <dl class="poster-specs">
      <div><dt>媒介</dt><dd>${escapeHtml(artifact.medium)}</dd></div>
      <div><dt>标记</dt><dd>${escapeHtml(artifact.rarity)}</dd></div>
    </dl>
  `;

  if (artifact.featured) {
    const mark = document.createElement("span");
    mark.className = "curator-mark";
    mark.setAttribute("aria-label", `精选馆藏：${artifact.rarity}`);
    mark.innerHTML = `
      <span class="curator-mark-monogram" aria-hidden="true">M</span>
      <span class="curator-mark-label" aria-hidden="true">精选</span>
    `;
    button.append(mark);
  }

  button.append(cover, body);
  article.append(button);
  return article;
}

function stopHeroStageAutoplay() {
  window.clearTimeout(heroStageAutoplayTimer);
  heroStageAutoplayTimer = 0;
}

function isHeroStageAutoplayPaused() {
  return heroStageInteractionPaused || heroStageMotionQuery.matches || document.hidden;
}

function scheduleHeroStageAutoplay() {
  stopHeroStageAutoplay();
  const autoplayPaused = isHeroStageAutoplayPaused();
  heroStageCaption?.setAttribute("aria-live", autoplayPaused ? "polite" : "off");
  if (heroStagedArtifacts.length < 2 || autoplayPaused) return;

  heroStageAutoplayTimer = window.setTimeout(() => {
    if (document.body.dataset.route !== "home" || document.body.dataset.accessRole === "locked") {
      scheduleHeroStageAutoplay();
      return;
    }
    moveHeroStage(1);
  }, HERO_STAGE_AUTOPLAY_DELAY);
}

function updateHeroStageCardPositions() {
  if (!heroStageGallery) return;

  const total = heroStagedArtifacts.length;
  Array.from(heroStageGallery.querySelectorAll<HTMLButtonElement>(".stage-card")).forEach((card, index) => {
    const position = (index - heroStageActiveIndex + total) % total;
    const isFront = position === 0;
    card.dataset.stagePosition = String(position);
    card.classList.toggle("is-front", isFront);
    card.tabIndex = isFront ? 0 : -1;
    card.inert = !isFront;
  });
}

function updateHeroStageCaption(animate = false) {
  if (!heroStageCaption || heroStagedArtifacts.length === 0) return;
  const artifact = heroStagedArtifacts[heroStageActiveIndex];
  const applyCaption = () => {
    heroStageCaption.innerHTML = `
      <span>展厅 ${escapeHtml(String(heroStageActiveIndex + 1).padStart(2, "0"))}</span>
      <strong>${escapeHtml(artifact.title)}</strong>
      <small>${escapeHtml(artifact.categoryLabel)} · ${escapeHtml(artifact.year)}</small>
    `;
  };

  window.clearTimeout(heroStageCaptionTimer);
  if (!animate || heroStageMotionQuery.matches) {
    heroStageCaption.classList.remove("is-changing");
    applyCaption();
    return;
  }

  heroStageCaption.classList.add("is-changing");
  heroStageCaptionTimer = window.setTimeout(() => {
    applyCaption();
    requestAnimationFrame(() => heroStageCaption.classList.remove("is-changing"));
  }, 210);
}

function moveHeroStage(direction: -1 | 1) {
  if (heroStagedArtifacts.length < 2 || heroStageAnimating) return;

  stopHeroStageAutoplay();
  heroStageActiveIndex = (heroStageActiveIndex + direction + heroStagedArtifacts.length) % heroStagedArtifacts.length;
  updateHeroStageCardPositions();
  updateHeroStageCaption(true);

  if (heroStageMotionQuery.matches) {
    scheduleHeroStageAutoplay();
    return;
  }

  heroStageAnimating = true;
  heroStageGallery?.classList.add("is-transitioning");
  window.clearTimeout(heroStageTransitionTimer);
  heroStageTransitionTimer = window.setTimeout(() => {
    heroStageAnimating = false;
    heroStageGallery?.classList.remove("is-transitioning");
    scheduleHeroStageAutoplay();
  }, HERO_STAGE_TRANSITION_DURATION);
}

function renderHeroStage() {
  if (!heroStageGallery || !heroStageCaption) return;

  stopHeroStageAutoplay();
  window.clearTimeout(heroStageCaptionTimer);
  window.clearTimeout(heroStageTransitionTimer);
  heroStageAnimating = false;
  heroStageActiveIndex = 0;
  heroStagedArtifacts = browsableArtifacts().filter((artifact) => artifact.featured).slice(0, 4);
  if (heroStagedArtifacts.length === 0) return;

  heroStageGallery.replaceChildren(
    ...heroStagedArtifacts.map((artifact, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-card";
      button.setAttribute("aria-label", `打开 ${artifact.title} 的藏品详情`);
      button.dataset.stagePosition = String(index);
      setCoverStyle(button, artifact);
      button.addEventListener("click", () => navigateToArtifact(artifact));

      const source = artifact.coverThumbnailImage ?? artifact.coverImage;
      if (source) {
        button.append(createImageElement(source, artifact.coverAlt, "eager", index === 0));
      }
      return button;
    })
  );
  updateHeroStageCardPositions();
  updateHeroStageCaption();
  scheduleHeroStageAutoplay();
}

function renderCategoryIndex() {
  if (!categoryIndex) return;

  const artifacts = browsableArtifacts();
  categoryIndex.replaceChildren(
    ...artifactCategories.filter((category) => category.id !== "all").map((category, index) => {
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

  artifactCategories.forEach((category) => {
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

function renderCatalogFacets() {
  const artifacts = browsableArtifacts();
  const tags = Array.from(new Set(artifacts.flatMap((artifact) => artifact.tags))).sort((first, second) =>
    first.localeCompare(second, "zh-CN")
  );
  const years = Array.from(
    new Set(
      artifacts
        .map((artifact) => artifact.artifactDate?.slice(0, 4) || artifact.year.trim())
        .filter((year) => /^\d{4}$/.test(year))
    )
  ).sort((first, second) => second.localeCompare(first));

  if (activeTag && !tags.includes(activeTag)) activeTag = "";
  if (activeYear && !years.includes(activeYear)) activeYear = "";

  if (artifactYearFilter) {
    artifactYearFilter.replaceChildren(
      new Option("全部年份", ""),
      ...years.map((year) => new Option(`${year} 年`, year))
    );
    artifactYearFilter.value = activeYear;
  }
  if (artifactSort) artifactSort.value = activeSort;

  if (tagFilterBar) {
    if (tags.length === 0) {
      tagFilterBar.replaceChildren();
      tagFilterBar.hidden = true;
    } else {
      tagFilterBar.hidden = false;
      const allButton = document.createElement("button");
      allButton.type = "button";
      allButton.className = "tag-filter-button";
      allButton.textContent = "全部标签";
      allButton.setAttribute("aria-pressed", String(activeTag === ""));
      allButton.addEventListener("click", () => {
        activeTag = "";
        renderCatalogFacets();
        renderCollection(true);
      });
      tagFilterBar.replaceChildren(
        allButton,
        ...tags.map((tag) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "tag-filter-button";
          button.textContent = tag;
          button.setAttribute("aria-pressed", String(activeTag === tag));
          button.addEventListener("click", () => {
            activeTag = activeTag === tag ? "" : tag;
            renderCatalogFacets();
            renderCollection(true);
          });
          return button;
        })
      );
    }
  }
}

export function renderCollection(animate = false) {
  if (!collectionGrid) return;

  const artifacts = browsableArtifacts();
  const artifactOrder = new Map(artifacts.map((artifact, index) => [artifact.id, index]));
  const visibleArtifacts = queryArtifacts(artifacts, searchQuery, activeFilter, {
    tag: activeTag,
    year: activeYear,
    sort: activeSort
  });
  if (collectionResultCount) {
    collectionResultCount.textContent = `当前显示 ${visibleArtifacts.length} / ${artifacts.length} 件藏品`;
  }
  if (visibleArtifacts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "collection-empty corner-flourish";
    empty.innerHTML = `<p class="volume-label">No matching records</p><h3>没有符合条件的藏品</h3><p>调整关键词、类别、标签或日期后再查看。</p>`;
    collectionGrid.replaceChildren(empty);
  } else {
    collectionGrid.replaceChildren(
      ...visibleArtifacts.map((artifact) => artifactCard(artifact, "standard", artifactOrder.get(artifact.id) ?? 0))
    );
  }
  if (animate) animateCollectionRefresh(collectionGrid);
}

function renderFeatured() {
  if (!featuredGallery) return;
  const artifacts = browsableArtifacts();
  const artifactOrder = new Map(artifacts.map((artifact, index) => [artifact.id, index]));
  const featured = artifacts.filter((artifact) => artifact.featured);
  featuredGallery.replaceChildren(
    ...featured.map((artifact) => artifactCard(artifact, "featured", artifactOrder.get(artifact.id) ?? 0))
  );
}

function visibleExhibitions() {
  return accessRole === "admin"
    ? museumExhibitions
    : museumExhibitions.filter((exhibition) => exhibition.visibility === "published");
}

function artifactsForExhibition(exhibition: MuseumExhibition) {
  const available = new Map(
    (accessRole === "admin" ? allArtifacts() : browsableArtifacts()).map((artifact) => [artifact.id, artifact])
  );
  return exhibition.artifactIds
    .map((id) => available.get(id))
    .filter((artifact): artifact is Artifact => Boolean(artifact));
}

function renderExhibitions() {
  if (!exhibitionGrid) return;
  const exhibitions = visibleExhibitions();
  if (exhibitions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "exhibition-empty corner-flourish";
    empty.innerHTML = `
      <p class="volume-label">Curatorial dossiers</p>
      <h3>专题卷宗尚未开放</h3>
      <p>${accessRole === "admin" ? "在藏品管理中创建第一份专题，并安排藏品的观看顺序。" : "策展人正在整理新的观看路径。"}</p>
    `;
    exhibitionGrid.replaceChildren(empty);
    return;
  }

  exhibitionGrid.replaceChildren(
    ...exhibitions.map((exhibition, index) => {
      const artifacts = artifactsForExhibition(exhibition);
      const article = document.createElement("article");
      article.className = "exhibition-card corner-flourish";
      article.setAttribute("data-motion-item", "exhibition");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "exhibition-card-button";
      button.setAttribute("aria-label", `打开策展专题 ${exhibition.title}`);
      button.addEventListener("click", () => navigateToExhibition(exhibition));

      const covers = document.createElement("div");
      covers.className = "exhibition-card-covers";
      artifacts.slice(0, 3).forEach((artifact) => {
        const cover = document.createElement("span");
        cover.className = "exhibition-card-cover arch-top sepia-reveal";
        setCoverStyle(cover, artifact);
        appendCoverImage(cover, artifact, true);
        covers.append(cover);
      });
      if (covers.childElementCount === 0) covers.classList.add("is-empty");

      const copy = document.createElement("div");
      copy.className = "exhibition-card-copy";
      copy.innerHTML = `
        <div class="exhibition-card-index"><span>Dossier ${String(index + 1).padStart(2, "0")}</span><span>${artifacts.length} 件藏品</span></div>
        <h3>${escapeHtml(exhibition.title)}</h3>
        <p>${escapeHtml(exhibition.summary)}</p>
        <span class="exhibition-open">展开卷宗 →</span>
      `;
      button.append(covers, copy);
      article.append(button);
      return article;
    })
  );
}

function renderExhibitionDetail(exhibition: MuseumExhibition) {
  if (!exhibitionIndexView || !exhibitionDetailView) return;
  const artifacts = artifactsForExhibition(exhibition);
  exhibitionIndexView.hidden = true;
  exhibitionDetailView.hidden = false;
  document.title = `${exhibition.title} | mxren-museum`;

  const heading = document.createElement("header");
  heading.className = "exhibition-detail-heading corner-flourish";
  heading.innerHTML = `
    <button class="exhibition-back" type="button">← 返回专题目录</button>
    <p class="volume-label">Curatorial dossier</p>
    <div class="dialog-visibility" data-visibility="${exhibition.visibility}">
      <span>${escapeHtml(visibilityLabels[exhibition.visibility])}</span>
      <small>${exhibition.visibility === "unlisted" ? "凭链接访问" : exhibition.visibility === "draft" ? "仅管理员可见" : "公开陈列"}</small>
    </div>
    <h2>${escapeHtml(exhibition.title)}</h2>
    <p class="exhibition-lede">${escapeHtml(exhibition.summary)}</p>
    ${exhibition.note ? `<p>${escapeHtml(exhibition.note)}</p>` : ""}
  `;
  heading.querySelector<HTMLButtonElement>(".exhibition-back")?.addEventListener("click", () => navigateToHash("#exhibitions"));

  const sequence = document.createElement("div");
  sequence.className = "exhibition-sequence";
  if (artifacts.length === 0) {
    sequence.innerHTML = `<div class="exhibition-empty"><h3>卷宗中的藏品暂不可见</h3><p>部分藏品可能仍是草稿，或已被移入回收站。</p></div>`;
  } else {
    sequence.replaceChildren(
      ...artifacts.map((artifact, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "exhibition-sequence-item";
        wrapper.innerHTML = `<span class="exhibition-sequence-number">${String(index + 1).padStart(2, "0")}</span>`;
        wrapper.append(artifactCard(artifact, "standard", index));
        return wrapper;
      })
    );
  }
  exhibitionDetailView.replaceChildren(heading, sequence);
}

async function syncExhibitionForRoute(routeState: RouteState) {
  if (!exhibitionIndexView || !exhibitionDetailView) return;
  if (!routeState.exhibitionId) {
    exhibitionIndexView.hidden = false;
    exhibitionDetailView.hidden = true;
    return;
  }

  let exhibition = museumExhibitions.find((candidate) => candidate.id === routeState.exhibitionId) ?? null;
  if (!exhibition) {
    try {
      exhibition = await loadMuseumExhibitionById(routeState.exhibitionId, adminSession);
    } catch (error) {
      console.warn("Exhibition deep link could not be loaded", error);
    }
  }
  if (exhibition?.visibility === "draft" && accessRole !== "admin") exhibition = null;
  if (!exhibition) {
    exhibitionIndexView.hidden = true;
    exhibitionDetailView.hidden = false;
    exhibitionDetailView.innerHTML = `
      <div class="exhibition-empty corner-flourish">
        <p class="volume-label">Archive notice</p>
        <h2>专题暂不可见</h2>
        <p>链接可能已失效，或这份专题仍处于仅管理员可见的草稿状态。</p>
        <button class="button button-secondary" type="button">返回专题目录</button>
      </div>`;
    exhibitionDetailView.querySelector("button")?.addEventListener("click", () => navigateToHash("#exhibitions"));
    return;
  }
  renderExhibitionDetail(exhibition);
}

function renderImageLightbox() {
  const image = activeLightboxImages[activeLightboxIndex];
  if (!image || !imageLightboxImage || !imageLightboxCaption || !imageLightboxCounter) return;

  imageLightboxImage.src = resolveAssetSrc(image.src);
  imageLightboxImage.alt = image.alt;
  imageLightboxCaption.textContent = image.label;
  imageLightboxCounter.textContent = `${activeLightboxIndex + 1} / ${activeLightboxImages.length}`;
  const hasMultipleImages = activeLightboxImages.length > 1;
  if (imageLightboxPrevious) imageLightboxPrevious.hidden = !hasMultipleImages;
  if (imageLightboxNext) imageLightboxNext.hidden = !hasMultipleImages;
}

function openImageLightbox(images: Artifact["galleryImages"], index: number, trigger: HTMLElement) {
  if (!imageLightbox || images.length === 0) return;
  activeLightboxImages = images;
  activeLightboxIndex = Math.min(Math.max(index, 0), images.length - 1);
  lightboxTrigger = trigger;
  renderImageLightbox();
  imageLightbox.showModal();
  imageLightboxClose?.focus();
}

function closeImageLightbox(restoreFocus = true) {
  if (!imageLightbox?.open) return;
  imageLightbox.close();
  activeLightboxImages = [];
  activeLightboxIndex = 0;
  if (restoreFocus) lightboxTrigger?.focus();
  lightboxTrigger = null;
}

function moveImageLightbox(direction: -1 | 1) {
  if (!imageLightbox?.open || activeLightboxImages.length < 2) return;
  activeLightboxIndex = (activeLightboxIndex + direction + activeLightboxImages.length) % activeLightboxImages.length;
  renderImageLightbox();
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("浏览器未允许复制，请从地址栏复制链接");
}

function showShareFeedback(button: HTMLButtonElement, message: string) {
  const originalLabel = button.textContent ?? "";
  button.textContent = message;
  window.setTimeout(() => {
    button.textContent = originalLabel;
  }, 1800);
}

function createArtifactShareActions(artifact: Artifact) {
  const actions = document.createElement("div");
  actions.className = "dialog-share-actions";
  actions.setAttribute("aria-label", "藏品分享操作");
  const url = artifactShareUrl(artifact.id);

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "button button-secondary dialog-share-button";
  copyButton.textContent = "复制藏品链接";
  copyButton.addEventListener("click", async () => {
    try {
      await copyText(url);
      showShareFeedback(copyButton, "链接已复制");
    } catch (error) {
      showShareFeedback(copyButton, error instanceof Error ? error.message : "复制失败");
    }
  });
  actions.append(copyButton);

  if (typeof navigator.share === "function") {
    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "button button-primary dialog-share-button";
    shareButton.textContent = "分享藏品";
    shareButton.addEventListener("click", async () => {
      try {
        await navigator.share({
          title: `${artifact.title} | mxren-museum`,
          text: artifact.summary,
          url
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        await copyText(url);
        showShareFeedback(shareButton, "链接已复制");
      }
    });
    actions.append(shareButton);
  }

  return actions;
}

export function openArtifactDialog(artifact: Artifact) {
  if (!dialog || !dialogBody) return;
  dialogClosing = false;
  activeDialogArtifactId = artifact.id;
  document.title = `${artifact.title} | mxren-museum`;

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
    <div class="dialog-visibility" data-visibility="${artifact.visibility}">
      <span>${escapeHtml(visibilityLabels[artifact.visibility])}</span>
      <small>${artifact.visibility === "unlisted" ? "凭链接访问" : artifact.visibility === "draft" ? "仅管理员可见" : "公开陈列"}</small>
    </div>
    <p class="volume-label">Volume ${escapeHtml(artifact.volume)}</p>
    <h2 id="dialog-title">${escapeHtml(artifact.title)}</h2>
    <dl class="artifact-ledger">
      <div><dt>类别</dt><dd>${escapeHtml(artifact.categoryLabel)}</dd></div>
      <div><dt>日期</dt><dd>${escapeHtml(artifact.artifactDate ?? artifact.year)}</dd></div>
      <div><dt>媒介</dt><dd>${escapeHtml(artifact.medium)}</dd></div>
      <div><dt>标记</dt><dd>${escapeHtml(artifact.rarity)}</dd></div>
    </dl>
    ${artifact.tags.length ? `<div class="dialog-tags" aria-label="藏品标签">${artifact.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
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
  artifact.galleryImages.forEach((galleryImage, index) => {
    const plate = document.createElement("figure");
    plate.className = "image-plate";
    plate.setAttribute("data-motion-item", "dialog-gallery");

    const zoomButton = document.createElement("button");
    zoomButton.className = "image-zoom-trigger";
    zoomButton.type = "button";
    zoomButton.setAttribute("aria-label", `放大查看${galleryImage.label}`);
    zoomButton.setAttribute("aria-haspopup", "dialog");
    const image = createImageElement(galleryImage.src, galleryImage.alt);
    image.setAttribute("data-motion-image", "");
    zoomButton.append(image);
    zoomButton.addEventListener("click", () => openImageLightbox(artifact.galleryImages, index, zoomButton));
    plate.append(zoomButton);

    const caption = document.createElement("figcaption");
    caption.innerHTML = `<span>${escapeHtml(galleryImage.label)}</span><small>点击放大</small>`;
    plate.append(caption);
    imageStrip.append(plate);
  });
  copy.insertBefore(imageStrip, copy.querySelector(".dialog-summary"));
  if (artifact.visibility !== "draft") copy.append(createArtifactShareActions(artifact));

  dialogBody.replaceChildren(cover, copy);
  if (!dialog.open) dialog.showModal();
  animateArtifactDialog(dialog);
}

export function closeArtifactDialog() {
  if (!dialog?.open || dialogClosing) return;

  closeImageLightbox(false);
  dialogClosing = true;
  animateArtifactDialogClose(dialog, () => {
    dialog.close();
    dialogClosing = false;
    activeDialogArtifactId = "";
    document.title = routeTitles[activeRouteState?.route ?? "collection"];
  });
}

function requestArtifactDialogClose() {
  if (!normalizedCurrentHash().startsWith("#artifact/")) {
    closeArtifactDialog();
    return;
  }

  if (artifactHistoryEntryCreated) {
    artifactHistoryEntryCreated = false;
    history.back();
    return;
  }

  history.replaceState({}, "", artifactReturnHash);
  syncRouteFromHash(false, false);
}

function openUnavailableArtifactDialog() {
  if (!dialog || !dialogBody) return;
  activeDialogArtifactId = "missing";
  dialogBody.innerHTML = `
    <div class="dialog-unavailable">
      <p class="volume-label">Archive notice</p>
      <h2 id="dialog-title">藏品暂不可见</h2>
      <p>链接可能已失效，或这件藏品仍处于仅管理员可见的草稿状态。</p>
      <button class="button button-secondary" type="button" data-close-unavailable>返回馆藏目录</button>
    </div>
  `;
  dialogBody.querySelector<HTMLButtonElement>("[data-close-unavailable]")?.addEventListener("click", requestArtifactDialogClose);
  if (!dialog.open) dialog.showModal();
  animateArtifactDialog(dialog);
}

async function syncArtifactDialogForRoute(routeState: RouteState) {
  const requestId = ++deepLinkRequestId;
  if (!routeState.artifactId) {
    linkedArtifact = null;
    if (dialog?.open) closeArtifactDialog();
    return;
  }

  if (activeDialogArtifactId === routeState.artifactId && dialog?.open) return;

  let artifact = artifactForDeepLink(routeState.artifactId);
  if (!artifact) {
    try {
      const loadedArtifact = await loadRemoteArtifactById(routeState.artifactId, adminSession);
      if (loadedArtifact) {
        linkedArtifact = loadedArtifact;
        artifact = loadedArtifact;
      }
    } catch (error) {
      console.warn("Artifact deep link could not be loaded", error);
    }
  }

  if (requestId !== deepLinkRequestId) return;
  if (!artifact) {
    openUnavailableArtifactDialog();
    return;
  }

  openArtifactDialog(artifact);
}

function releasePendingPreviewUrls() {
  pendingPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  pendingPreviewUrls = [];
}

export function createImagePreviewUrl(file: File) {
  validateImageFile(file);
  const url = URL.createObjectURL(file);
  pendingPreviewUrls.push(url);
  return url;
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
    pendingCoverStoragePath = undefined;
    pendingCoverThumbnailImage = undefined;
    pendingCoverThumbnailStoragePath = undefined;
    pendingCoverImage = createImagePreviewUrl(file);
    renderUploadPreviews();
    showManagerStatus("封面已载入", "success");
  } catch (error) {
    showManagerStatus(error instanceof Error ? error.message : "图片读取失败，请换一张图片", "danger");
  }
}

async function handleGalleryUpload(event: Event) {
  if (!requireManageAccess("上传详情图片")) return;

  const input = event.currentTarget as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length === 0) return;
  if (files.length > 3) {
    showManagerStatus("详情图片最多上传 3 张", "danger");
    input.value = "";
    return;
  }

  try {
    files.forEach(validateImageFile);
    const sources = files.map((file) => createImagePreviewUrl(file));
    pendingGalleryFiles = files;
    const title = artifactFormTitle?.value.trim() || "本地藏品";
    pendingGalleryImages = sources.map((src, index) => ({
      src,
      alt: `${title} 的详情图片 ${index + 1}`,
      label: ["细节", "记忆", "图板"][index] ?? `图 ${index + 1}`
    }));
    renderUploadPreviews();
    showManagerStatus("详情图片已载入", "success");
  } catch (error) {
    showManagerStatus(error instanceof Error ? error.message : "图片读取失败，请换一张图片", "danger");
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
    const session = await signInRemoteUser(username, password);
    await syncRemoteAccess(session);
    if (accessRole === "admin") await reloadManagedArtifactData(session);
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
  await reloadManagedArtifactData(null);
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
  const selectedVisibility = artifactVisibilityInputs.find((input) => input.checked)?.value;
  const visibility: ArtifactVisibility =
    selectedVisibility === "published" || selectedVisibility === "unlisted" ? selectedVisibility : "draft";

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
    categoryLabel: artifactCategories.find((item) => item.id === category)?.label ?? "个人藏品",
    tags: normalizeArtifactTags(artifactFormTags?.value ?? ""),
    artifactDate: artifactFormDate?.value || undefined,
    year: artifactFormYear?.value.trim() ?? "",
    medium: artifactFormMedium?.value.trim() ?? "",
    rarity: artifactFormRarity?.value.trim() ?? "",
    featured: artifactFormFeatured?.checked ?? false,
    visibility,
    coverImage: pendingCoverImage,
    coverAlt: `${title} 的藏品封面`,
    coverFile: pendingCoverFile,
    coverStoragePath: pendingCoverStoragePath,
    coverThumbnailImage: pendingCoverThumbnailImage,
    coverThumbnailStoragePath: pendingCoverThumbnailStoragePath,
    galleryImages: pendingGalleryImages,
    galleryFiles: pendingGalleryFiles,
    summary: artifactFormSummary?.value.trim() ?? "",
    note: artifactFormNote?.value.trim() ?? ""
  };
}

function resetArtifactForm(updateStatus = true) {
  releasePendingPreviewUrls();
  artifactForm?.reset();
  closeCategoryEditor();
  renderArtifactCategoryOptions("games");
  if (artifactFormId) artifactFormId.value = "";
  if (artifactFormTags) artifactFormTags.value = "";
  if (artifactFormDate) artifactFormDate.value = "";
  editingArtifactId = null;
  pendingCoverImage = "";
  pendingCoverFile = null;
  pendingCoverStoragePath = undefined;
  pendingCoverThumbnailImage = undefined;
  pendingCoverThumbnailStoragePath = undefined;
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
  if (isSavingArtifact) return;

  const input = artifactFormInput();
  if (!input) return;

  setArtifactSavingState(true);
  try {
    const successMessage = editingArtifactId ? "藏品已更新" : "藏品已保存";
    if (persistenceMode === "supabase" && adminSession) {
      showManagerStatus("正在优化并上传图片");
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
    showArtifactSaveError(detail);
  } finally {
    setArtifactSavingState(false);
  }
}

export function handleArtifactEdit(id: string) {
  if (!requireManageAccess("修改藏品")) return;

  const artifact = allArtifacts().find((item) => item.id === id);
  if (!artifact) return;

  releasePendingPreviewUrls();
  editingArtifactId = artifact.id;
  pendingCoverImage = artifact.coverImage;
  pendingCoverFile = null;
  pendingCoverStoragePath = artifact.coverStoragePath;
  pendingCoverThumbnailImage = artifact.coverThumbnailImage;
  pendingCoverThumbnailStoragePath = artifact.coverThumbnailStoragePath;
  pendingGalleryImages = artifact.galleryImages.map((image) => ({ ...image }));
  pendingGalleryFiles = [];

  if (artifactFormId) artifactFormId.value = artifact.id;
  if (artifactFormTitle) artifactFormTitle.value = artifact.title;
  closeCategoryEditor();
  renderArtifactCategoryOptions(artifact.category);
  if (artifactFormYear) artifactFormYear.value = artifact.year;
  if (artifactFormDate) artifactFormDate.value = artifact.artifactDate ?? "";
  if (artifactFormTags) artifactFormTags.value = artifact.tags.join("，");
  if (artifactFormMedium) artifactFormMedium.value = artifact.medium;
  if (artifactFormRarity) artifactFormRarity.value = artifact.rarity;
  if (artifactFormSummary) artifactFormSummary.value = artifact.summary;
  if (artifactFormNote) artifactFormNote.value = artifact.note;
  if (artifactFormFeatured) artifactFormFeatured.checked = artifact.featured;
  artifactVisibilityInputs.forEach((input) => {
    input.checked = input.value === artifact.visibility;
  });
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
    ? `将「${artifact.title}」的云端版本移入回收站，并恢复内置版本？`
    : `将藏品「${artifact.title}」移入回收站？`;
  if (!globalThis.confirm(confirmation)) return;

  try {
    if (artifact.source === "remote" && persistenceMode === "supabase") {
      await deleteRemoteArtifact(artifact.remoteId ?? id, adminSession);
      managedArtifacts = managedArtifacts.filter((item) => item.id !== id);
      trashedArtifacts = [{ ...artifact, deletedAt: new Date().toISOString() }, ...trashedArtifacts];
      if (artifact.sourceArtifactId) hiddenSourceArtifactIds.delete(artifact.sourceArtifactId);
    } else {
      showManagerStatus("云端不可用，暂时只能查看藏品", "danger");
      return;
    }

    if (editingArtifactId === id) resetArtifactForm();
    showManagerStatus(restoresSample ? "云端版本已移入回收站，已恢复内置版本" : "藏品已移入回收站", "success");
    refreshMuseumView();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    showManagerStatus(`删除失败：${detail}`, "danger");
  }
}

async function handleArtifactRestore(artifact: ManagedArtifact) {
  if (!requireManageAccess("恢复藏品") || !adminSession) return;
  try {
    const restored = await restoreRemoteArtifact(artifact.remoteId ?? artifact.id, adminSession);
    trashedArtifacts = trashedArtifacts.filter((item) => item.remoteId !== restored.remoteId);
    managedArtifacts = [...managedArtifacts, restored];
    if (restored.sourceArtifactId && restored.visibility !== "published") {
      hiddenSourceArtifactIds.add(restored.sourceArtifactId);
    }
    showManagerStatus(`已恢复：${restored.title}`, "success");
    refreshMuseumView();
  } catch (error) {
    showManagerStatus(`恢复失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleArtifactPurge(artifact: ManagedArtifact) {
  if (!requireManageAccess("彻底删除藏品") || !adminSession) return;
  const confirmed = globalThis.confirm(`彻底删除「${artifact.title}」？此操作无法撤销。`);
  if (!confirmed) return;
  const doubleConfirmed = globalThis.confirm("最后确认：数据库记录与图片对象都会被删除，确定继续？");
  if (!doubleConfirmed) return;

  try {
    const warning = await purgeRemoteArtifact(
      artifact.remoteId ?? artifact.id,
      adminSession,
      artifactStoragePaths(artifact)
    );
    trashedArtifacts = trashedArtifacts.filter((item) => item.remoteId !== artifact.remoteId);
    showManagerStatus(warning || `已彻底删除：${artifact.title}`, warning ? "danger" : "success");
    refreshMuseumView();
  } catch (error) {
    showManagerStatus(`彻底删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function renderTrash() {
  const canManage = canManageArtifacts();
  if (artifactTrashToggle) artifactTrashToggle.hidden = !canManage;
  if (museumExportJson) museumExportJson.hidden = !canManage;
  if (artifactTrashCount) artifactTrashCount.textContent = String(trashedArtifacts.length);
  if (!artifactTrashList) return;

  if (trashedArtifacts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "manager-empty";
    empty.textContent = "回收站为空。";
    artifactTrashList.replaceChildren(empty);
    return;
  }

  artifactTrashList.replaceChildren(
    ...trashedArtifacts.map((artifact) => {
      const row = document.createElement("article");
      row.className = "manager-row trash-row";
      const copy = document.createElement("div");
      copy.innerHTML = `<h4>${escapeHtml(artifact.title)}</h4><p>${escapeHtml(artifact.categoryLabel)} · ${escapeHtml(artifact.deletedAt?.slice(0, 10) ?? "删除时间未知")}</p>`;
      const actions = document.createElement("div");
      actions.className = "manager-actions";
      const restore = document.createElement("button");
      restore.type = "button";
      restore.className = "button button-secondary";
      restore.textContent = "恢复";
      restore.addEventListener("click", () => void handleArtifactRestore(artifact));
      const purge = document.createElement("button");
      purge.type = "button";
      purge.className = "button button-danger";
      purge.textContent = "彻底删除";
      purge.addEventListener("click", () => void handleArtifactPurge(artifact));
      actions.append(restore, purge);
      row.append(copy, actions);
      return row;
    })
  );
}

function handleMuseumExport() {
  if (!requireManageAccess("导出馆藏") || !adminSession) return;
  const categories = artifactCategories.filter(
    (category): category is ArtifactCategoryDefinition => category.id !== "all"
  );
  const payload = createMuseumExport(allArtifacts(), trashedArtifacts, categories, museumExhibitions);
  downloadMuseumExport(payload);
  showManagerStatus(`已导出 ${payload.counts.artifacts} 件馆藏、${payload.counts.trash} 件回收记录`, "success");
}

function renderManagerList() {
  if (!artifactManagerList) return;
  const canManage = canManageArtifacts();
  const artifacts = canManage ? allArtifacts() : browsableArtifacts();

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
      const visibility = document.createElement("span");
      visibility.className = "manager-visibility";
      visibility.dataset.visibility = artifact.visibility;
      visibility.textContent = visibilityLabels[artifact.visibility];
      const badges = document.createElement("div");
      badges.className = "manager-badges";
      badges.append(source, visibility);
      copy.append(title, meta, badges);

      const actions = document.createElement("div");
      actions.className = "manager-actions";

      if (canManage) {
        const previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.className = "button button-secondary";
        previewButton.textContent = "预览";
        previewButton.setAttribute("aria-label", `预览 ${artifact.title}`);
        previewButton.addEventListener("click", () => navigateToArtifact(artifact));

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "button button-secondary";
        editButton.textContent = "修改";
        editButton.setAttribute("aria-label", `修改 ${artifact.title}`);
        editButton.addEventListener("click", () => handleArtifactEdit(artifact.id));

        actions.append(previewButton, editButton);
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

function showExhibitionStatus(message: string, tone: "neutral" | "success" | "danger" = "neutral") {
  if (!exhibitionManagerStatus) return;
  exhibitionManagerStatus.textContent = message;
  exhibitionManagerStatus.dataset.tone = tone;
}

function renderExhibitionArtifactOrder() {
  if (!exhibitionArtifactOrder) return;
  const artifactsById = new Map(allArtifacts().map((artifact) => [artifact.id, artifact]));
  exhibitionArtifactOrder.replaceChildren(
    ...selectedExhibitionArtifactIds.map((id, index) => {
      const artifact = artifactsById.get(id);
      const item = document.createElement("li");
      item.innerHTML = `<span><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(artifact?.title ?? id)}</span>`;
      const actions = document.createElement("div");
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "↑";
      up.setAttribute("aria-label", `上移 ${artifact?.title ?? id}`);
      up.disabled = index === 0;
      up.addEventListener("click", () => {
        [selectedExhibitionArtifactIds[index - 1], selectedExhibitionArtifactIds[index]] = [
          selectedExhibitionArtifactIds[index],
          selectedExhibitionArtifactIds[index - 1]
        ];
        renderExhibitionArtifactOrder();
      });
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "↓";
      down.setAttribute("aria-label", `下移 ${artifact?.title ?? id}`);
      down.disabled = index === selectedExhibitionArtifactIds.length - 1;
      down.addEventListener("click", () => {
        [selectedExhibitionArtifactIds[index], selectedExhibitionArtifactIds[index + 1]] = [
          selectedExhibitionArtifactIds[index + 1],
          selectedExhibitionArtifactIds[index]
        ];
        renderExhibitionArtifactOrder();
      });
      actions.append(up, down);
      item.append(actions);
      return item;
    })
  );
}

function renderExhibitionEditor() {
  if (!exhibitionForm || !exhibitionArtifactOptions) return;
  const canManage = canManageArtifacts();
  exhibitionForm.hidden = !canManage;
  if (!canManage) {
    showExhibitionStatus("游客只读", "neutral");
    return;
  }

  showExhibitionStatus(editingExhibitionId ? "正在编辑专题" : "可新建策展专题", "success");
  const artifacts = allArtifacts();
  exhibitionArtifactOptions.replaceChildren(
    ...artifacts.map((artifact) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = artifact.id;
      checkbox.checked = selectedExhibitionArtifactIds.includes(artifact.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          if (!selectedExhibitionArtifactIds.includes(artifact.id)) selectedExhibitionArtifactIds.push(artifact.id);
        } else {
          selectedExhibitionArtifactIds = selectedExhibitionArtifactIds.filter((id) => id !== artifact.id);
        }
        renderExhibitionArtifactOrder();
      });
      const copy = document.createElement("span");
      copy.innerHTML = `<strong>${escapeHtml(artifact.title)}</strong><small>${escapeHtml(artifact.categoryLabel)} · ${escapeHtml(visibilityLabels[artifact.visibility])}</small>`;
      label.append(checkbox, copy);
      return label;
    })
  );
  renderExhibitionArtifactOrder();
}

function resetExhibitionForm() {
  editingExhibitionId = null;
  selectedExhibitionArtifactIds = [];
  exhibitionForm?.reset();
  if (exhibitionFormId) exhibitionFormId.readOnly = false;
  renderExhibitionEditor();
}

function exhibitionFormInput(): ExhibitionFormInput | null {
  const title = exhibitionFormTitle?.value.trim() ?? "";
  const id = normalizeExhibitionId(exhibitionFormId?.value ?? "");
  const visibilityValue = exhibitionVisibilityInputs.find((input) => input.checked)?.value;
  const visibility: ArtifactVisibility =
    visibilityValue === "published" || visibilityValue === "unlisted" ? visibilityValue : "draft";
  if (!title) {
    showExhibitionStatus("请填写专题标题", "danger");
    exhibitionFormTitle?.focus();
    return null;
  }
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(id)) {
    showExhibitionStatus("专题标识需为 3 至 64 位小写字母、数字或连字符", "danger");
    exhibitionFormId?.focus();
    return null;
  }
  if (selectedExhibitionArtifactIds.length === 0) {
    showExhibitionStatus("请至少选择一件藏品", "danger");
    exhibitionArtifactOptions?.scrollIntoView({ behavior: "smooth", block: "center" });
    return null;
  }
  return {
    id,
    title,
    summary: exhibitionFormSummary?.value.trim() ?? "",
    note: exhibitionFormNote?.value.trim() ?? "",
    visibility,
    artifactIds: [...selectedExhibitionArtifactIds]
  };
}

async function handleExhibitionSubmit(event: SubmitEvent) {
  event.preventDefault();
  if (!requireManageAccess("保存专题") || !adminSession) return;
  const input = exhibitionFormInput();
  if (!input) return;
  try {
    showExhibitionStatus("正在保存专题");
    const saved = await saveMuseumExhibition(input, adminSession);
    const index = museumExhibitions.findIndex((exhibition) => exhibition.id === saved.id);
    if (index >= 0) museumExhibitions[index] = saved;
    else museumExhibitions.push(saved);
    resetExhibitionForm();
    refreshMuseumView();
    showExhibitionStatus("专题已保存", "success");
  } catch (error) {
    showExhibitionStatus(`专题未保存：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function handleExhibitionEdit(exhibition: MuseumExhibition) {
  if (!requireManageAccess("修改专题")) return;
  editingExhibitionId = exhibition.id;
  selectedExhibitionArtifactIds = [...exhibition.artifactIds];
  if (exhibitionFormTitle) exhibitionFormTitle.value = exhibition.title;
  if (exhibitionFormId) {
    exhibitionFormId.value = exhibition.id;
    exhibitionFormId.readOnly = true;
  }
  if (exhibitionFormSummary) exhibitionFormSummary.value = exhibition.summary;
  if (exhibitionFormNote) exhibitionFormNote.value = exhibition.note;
  exhibitionVisibilityInputs.forEach((input) => {
    input.checked = input.value === exhibition.visibility;
  });
  renderExhibitionEditor();
  exhibitionForm?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleExhibitionDelete(exhibition: MuseumExhibition) {
  if (!requireManageAccess("删除专题") || !adminSession) return;
  if (!globalThis.confirm(`删除策展专题「${exhibition.title}」？藏品本身不会被删除。`)) return;
  try {
    await deleteMuseumExhibition(exhibition.id, adminSession);
    museumExhibitions = museumExhibitions.filter((item) => item.id !== exhibition.id);
    if (editingExhibitionId === exhibition.id) resetExhibitionForm();
    refreshMuseumView();
    showExhibitionStatus("专题已删除", "success");
  } catch (error) {
    showExhibitionStatus(`专题删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function renderExhibitionManagerList() {
  if (!exhibitionManagerList) return;
  const canManage = canManageArtifacts();
  if (museumExhibitions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "manager-empty";
    empty.textContent = "还没有策展专题。";
    exhibitionManagerList.replaceChildren(empty);
    return;
  }
  exhibitionManagerList.replaceChildren(
    ...museumExhibitions.map((exhibition) => {
      const row = document.createElement("article");
      row.className = "manager-row";
      const copy = document.createElement("div");
      copy.innerHTML = `<h4>${escapeHtml(exhibition.title)}</h4><p>${exhibition.artifactIds.length} 件藏品 · ${escapeHtml(visibilityLabels[exhibition.visibility])}</p>`;
      const actions = document.createElement("div");
      actions.className = "manager-actions";
      if (canManage) {
        const preview = document.createElement("button");
        preview.type = "button";
        preview.className = "button button-secondary";
        preview.textContent = "预览";
        preview.addEventListener("click", () => navigateToExhibition(exhibition));
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "button button-secondary";
        edit.textContent = "修改";
        edit.addEventListener("click", () => handleExhibitionEdit(exhibition));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button button-danger";
        remove.textContent = "删除";
        remove.addEventListener("click", () => void handleExhibitionDelete(exhibition));
        actions.append(preview, edit, remove);
      } else {
        const badge = document.createElement("span");
        badge.className = "manager-readonly";
        badge.textContent = "只读";
        actions.append(badge);
      }
      row.append(copy, actions);
      return row;
    })
  );
}

function bindDialogEvents() {
  dialogClose?.addEventListener("click", requestArtifactDialogClose);

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) {
      requestArtifactDialogClose();
    }
  });

  dialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestArtifactDialogClose();
  });

  imageLightboxClose?.addEventListener("click", () => closeImageLightbox());
  imageLightboxPrevious?.addEventListener("click", () => moveImageLightbox(-1));
  imageLightboxNext?.addEventListener("click", () => moveImageLightbox(1));

  imageLightbox?.addEventListener("click", (event) => {
    if (event.target === imageLightbox) closeImageLightbox();
  });

  imageLightbox?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeImageLightbox();
  });

  artifactSaveErrorClose?.addEventListener("click", closeArtifactSaveError);
  artifactSaveErrorConfirm?.addEventListener("click", closeArtifactSaveError);
  artifactSaveError?.addEventListener("click", (event) => {
    if (event.target === artifactSaveError) closeArtifactSaveError();
  });
  artifactSaveError?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeArtifactSaveError();
  });

  document.addEventListener("keydown", (event) => {
    if (imageLightbox?.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeImageLightbox();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveImageLightbox(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveImageLightbox(1);
      }
      return;
    }

    if (event.key === "Escape" && dialog?.open) {
      requestArtifactDialogClose();
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
  artifactYearFilter?.addEventListener("change", () => {
    activeYear = artifactYearFilter.value;
    renderCollection(true);
  });
  artifactSort?.addEventListener("change", () => {
    const value = artifactSort.value;
    activeSort = value === "date-desc" || value === "date-asc" || value === "updated-desc" || value === "title-asc"
      ? value
      : "catalog";
    renderCollection(true);
  });
  artifactFilterReset?.addEventListener("click", () => {
    activeFilter = "all";
    activeTag = "";
    activeYear = "";
    activeSort = "catalog";
    searchQuery = "";
    if (artifactSearch) artifactSearch.value = "";
    if (artifactSort) artifactSort.value = "catalog";
    renderCategoryIndex();
    renderFilters();
    renderCatalogFacets();
    renderCollection(true);
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
  artifactFormCategory?.addEventListener("change", () => {
    if (artifactFormCategory.value === NEW_CATEGORY_VALUE) {
      openCategoryEditor(null);
      setManagementControlsDisabled();
      return;
    }

    categorySelectionBeforeCreate = artifactFormCategory.value;
    closeCategoryEditor();
    setManagementControlsDisabled();
  });
  artifactCategoryEdit?.addEventListener("click", () => {
    const category = artifactFormCategory?.value ?? "";
    if (isArtifactCategory(category)) openCategoryEditor(category);
  });
  artifactCategorySave?.addEventListener("click", () => {
    void handleCategorySave();
  });
  artifactCategoryCancel?.addEventListener("click", () => {
    const restorePreviousSelection = editingCategoryId === null;
    closeCategoryEditor(restorePreviousSelection);
  });
  artifactFormReset?.addEventListener("click", () => resetArtifactForm());
  museumExportJson?.addEventListener("click", handleMuseumExport);
  artifactTrashToggle?.addEventListener("click", () => {
    if (!artifactTrashPanel || !artifactTrashToggle) return;
    artifactTrashPanel.hidden = !artifactTrashPanel.hidden;
    artifactTrashToggle.setAttribute("aria-expanded", String(!artifactTrashPanel.hidden));
  });
  exhibitionForm?.addEventListener("submit", (event) => {
    void handleExhibitionSubmit(event);
  });
  exhibitionReset?.addEventListener("click", resetExhibitionForm);
  exhibitionFormTitle?.addEventListener("blur", () => {
    if (exhibitionFormId && !exhibitionFormId.value.trim()) {
      exhibitionFormId.value = normalizeExhibitionId(exhibitionFormTitle.value);
    }
  });
}

function bindHeroStageEvents() {
  heroStageHost?.addEventListener("pointerenter", () => {
    heroStageInteractionPaused = true;
    stopHeroStageAutoplay();
  });
  heroStageHost?.addEventListener("pointerleave", () => {
    heroStageInteractionPaused = false;
    scheduleHeroStageAutoplay();
  });
  heroStageHost?.addEventListener("focusin", () => {
    heroStageInteractionPaused = true;
    stopHeroStageAutoplay();
  });
  heroStageHost?.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && heroStageHost.contains(event.relatedTarget)) return;
    heroStageInteractionPaused = false;
    scheduleHeroStageAutoplay();
  });
  document.addEventListener("visibilitychange", scheduleHeroStageAutoplay);
  heroStageMotionQuery.addEventListener("change", scheduleHeroStageAutoplay);
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
  if (artifactCount) artifactCount.textContent = String(browsableArtifacts().length).padStart(2, "0");
  if (categoryCount) categoryCount.textContent = String(artifactCategories.length - 1).padStart(2, "0");
}

function initMuseum() {
  initMuseumCanvas();
  renderArtifactCategoryOptions("games");
  updateCounts();
  renderHeroStage();
  renderFeatured();
  renderExhibitions();
  renderCategoryIndex();
  renderFilters();
  renderCatalogFacets();
  renderCollection();
  renderManagerList();
  renderTrash();
  renderExhibitionEditor();
  renderExhibitionManagerList();
  renderUploadPreviews();
  renderAuthState();
  bindDialogEvents();
  bindManagementEvents();
  bindHeroStageEvents();
  bindAuthEvents();
  bindRouteEvents();
  initMuseumMotion();
  void hydrateManagedArtifacts();
}

initMuseum();
