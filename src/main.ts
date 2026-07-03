import "./styles.css";
import { artifacts as sampleArtifacts, categories, type Artifact, type ArtifactCategory } from "./collection";
import {
  createLocalArtifact,
  deleteLocalArtifact,
  loadLocalArtifacts,
  queryArtifacts,
  saveLocalArtifacts,
  updateLocalArtifact,
  type ArtifactFormInput,
  type GalleryImageInput,
  type ManagedArtifact
} from "./artifact-store";
import {
  animateArtifactDialog,
  animateArtifactDialogClose,
  initMuseumMotion,
  refreshMuseumScrollAnimations
} from "./museum-motion";

type FilterId = "all" | ArtifactCategory;
type MuseumRoute = "home" | "collection" | "manage";

interface RouteState {
  route: MuseumRoute;
  targetId: string;
}

const routeTitles: Record<MuseumRoute, string> = {
  home: "mxren-museum | 私人数字藏馆",
  collection: "馆藏目录 | mxren-museum",
  manage: "藏品管理 | mxren-museum"
};

let activeFilter: FilterId = "all";
let searchQuery = "";
let dialogClosing = false;
let localArtifacts: ManagedArtifact[] = loadLocalArtifacts();
let editingArtifactId: string | null = null;
let pendingCoverImage = "";
let pendingGalleryImages: GalleryImageInput[] = [];
const basePath = ((import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/").replace(/\/?$/, "/");

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
const artifactManagerStatus = document.querySelector<HTMLElement>("#artifact-manager-status");
const artifactFormReset = document.querySelector<HTMLButtonElement>("#artifact-form-reset");
const pageElements = Array.from(document.querySelectorAll<HTMLElement>("[data-page]"));
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".site-nav [data-nav-route]"));

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

function createImageElement(src: string, alt: string) {
  const image = document.createElement("img");
  image.src = resolveAssetSrc(src);
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
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

function showRoutePage(routeState: RouteState, shouldScroll = true) {
  document.body.dataset.route = routeState.route;
  document.title = routeTitles[routeState.route];

  pageElements.forEach((element) => {
    element.hidden = element.dataset.page !== routeState.route;
  });

  setActiveNavigation(routeState);

  requestAnimationFrame(() => {
    refreshMuseumScrollAnimations();

    if (!shouldScroll) return;
    document.getElementById(routeState.targetId)?.scrollIntoView({ block: "start" });
  });
}

function syncRouteFromHash(shouldScroll = true) {
  showRoutePage(routeFromHash(), shouldScroll);
}

function allArtifacts() {
  return [...sampleArtifacts, ...localArtifacts];
}

function artifactNumber(artifact: Artifact) {
  const index = allArtifacts().findIndex((item) => item.id === artifact.id);
  return `No.${String(Math.max(index, 0) + 1).padStart(3, "0")}`;
}

function persistLocalArtifacts() {
  saveLocalArtifacts(localArtifacts);
}

function showManagerStatus(message: string, tone: "neutral" | "success" | "danger" = "neutral") {
  if (!artifactManagerStatus) return;
  artifactManagerStatus.textContent = message;
  artifactManagerStatus.dataset.tone = tone;
}

function refreshMuseumView() {
  updateCounts();
  renderHeroStage();
  renderFeatured();
  renderCategoryIndex();
  renderFilters();
  renderCollection();
  renderManagerList();
  requestAnimationFrame(refreshMuseumScrollAnimations);
}

function appendCoverImage(cover: HTMLElement, artifact: Artifact) {
  if (artifact.coverImage) {
    cover.append(createImageElement(artifact.coverImage, artifact.coverAlt));
  }
  cover.insertAdjacentHTML("beforeend", `<span class="cover-symbol" aria-hidden="true">${escapeHtml(artifact.symbol)}</span>`);
}

function artifactCard(artifact: Artifact, variant: "featured" | "standard") {
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
      <span>${escapeHtml(artifactNumber(artifact))}</span>
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
        button.append(createImageElement(artifact.coverImage, artifact.coverAlt));
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
        renderCollection();
        collectionGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
        requestAnimationFrame(refreshMuseumScrollAnimations);
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
      renderCollection();
      requestAnimationFrame(refreshMuseumScrollAnimations);
    });
    filterBar.append(button);
  });
}

export function renderCollection() {
  if (!collectionGrid) return;

  const visibleArtifacts = queryArtifacts(allArtifacts(), searchQuery, activeFilter);
  collectionGrid.replaceChildren(...visibleArtifacts.map((artifact) => artifactCard(artifact, "standard")));
}

function renderFeatured() {
  if (!featuredGallery) return;
  const featured = allArtifacts().filter((artifact) => artifact.featured);
  featuredGallery.replaceChildren(...featured.map((artifact) => artifactCard(artifact, "featured")));
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
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    pendingCoverImage = await readImageFileAsDataUrl(file);
    renderUploadPreviews();
    showManagerStatus("封面已载入", "success");
  } catch {
    showManagerStatus("图片读取失败，请换一张图片", "danger");
  }
}

async function handleGalleryUpload(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const files = Array.from(input.files ?? []).slice(0, 3);
  if (files.length === 0) return;

  try {
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
    galleryImages: pendingGalleryImages,
    summary: artifactFormSummary?.value.trim() ?? "",
    note: artifactFormNote?.value.trim() ?? ""
  };
}

function resetArtifactForm() {
  artifactForm?.reset();
  if (artifactFormId) artifactFormId.value = "";
  editingArtifactId = null;
  pendingCoverImage = "";
  pendingGalleryImages = [];
  if (artifactFormHeading) artifactFormHeading.textContent = "新增藏品";
  renderUploadPreviews();
  showManagerStatus("browser-local storage");
}

export async function handleArtifactSubmit(event: SubmitEvent) {
  event.preventDefault();
  const input = artifactFormInput();
  if (!input) return;

  try {
    const successMessage = editingArtifactId ? "藏品已更新" : "藏品已保存";
    if (editingArtifactId) {
      localArtifacts = updateLocalArtifact(editingArtifactId, input, localArtifacts);
    } else {
      const created = createLocalArtifact(input, allArtifacts());
      localArtifacts = [...localArtifacts, created];
    }

    persistLocalArtifacts();
    resetArtifactForm();
    showManagerStatus(successMessage, "success");
    refreshMuseumView();
  } catch {
    showManagerStatus("浏览器存储空间不足，藏品未保存", "danger");
  }
}

export function handleArtifactEdit(id: string) {
  const artifact = localArtifacts.find((item) => item.id === id);
  if (!artifact) return;

  editingArtifactId = artifact.id;
  pendingCoverImage = artifact.coverImage;
  pendingGalleryImages = artifact.galleryImages.map((image) => ({ ...image }));

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

export function handleArtifactDelete(id: string) {
  const artifact = localArtifacts.find((item) => item.id === id);
  if (!artifact) return;

  if (!globalThis.confirm(`删除本地藏品「${artifact.title}」？`)) return;

  localArtifacts = deleteLocalArtifact(id, localArtifacts);
  persistLocalArtifacts();
  if (editingArtifactId === id) resetArtifactForm();
  showManagerStatus("藏品已删除", "success");
  refreshMuseumView();
}

function renderManagerList() {
  if (!artifactManagerList) return;

  if (localArtifacts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "manager-empty";
    empty.textContent = "还没有本地新增藏品。";
    artifactManagerList.replaceChildren(empty);
    return;
  }

  artifactManagerList.replaceChildren(
    ...localArtifacts.map((artifact) => {
      const row = document.createElement("article");
      row.className = "manager-row";

      const copy = document.createElement("div");
      const title = document.createElement("h4");
      title.textContent = artifact.title;
      const meta = document.createElement("p");
      meta.textContent = `${artifact.categoryLabel} · ${artifact.year} · ${artifact.rarity}`;
      copy.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "manager-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "button button-secondary";
      editButton.textContent = "修改";
      editButton.setAttribute("aria-label", `修改 ${artifact.title}`);
      editButton.addEventListener("click", () => handleArtifactEdit(artifact.id));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button button-danger";
      deleteButton.textContent = "删除";
      deleteButton.setAttribute("aria-label", `删除 ${artifact.title}`);
      deleteButton.addEventListener("click", () => handleArtifactDelete(artifact.id));

      actions.append(editButton, deleteButton);
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
    searchQuery = artifactSearch.value;
    renderCollection();
    requestAnimationFrame(refreshMuseumScrollAnimations);
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
  artifactFormReset?.addEventListener("click", resetArtifactForm);
}

function bindRouteEvents() {
  window.addEventListener("hashchange", () => syncRouteFromHash());
}

function updateCounts() {
  if (artifactCount) artifactCount.textContent = String(allArtifacts().length).padStart(2, "0");
  if (categoryCount) categoryCount.textContent = String(categories.length - 1).padStart(2, "0");
}

function initMuseum() {
  updateCounts();
  renderHeroStage();
  renderFeatured();
  renderCategoryIndex();
  renderFilters();
  renderCollection();
  renderManagerList();
  renderUploadPreviews();
  bindDialogEvents();
  bindManagementEvents();
  bindRouteEvents();
  syncRouteFromHash();
  initMuseumMotion();
}

initMuseum();
