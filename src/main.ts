import "./styles.css";
import { artifacts, categories, type Artifact, type ArtifactCategory } from "./collection";
import {
  animateArtifactDialog,
  animateArtifactDialogClose,
  initMuseumMotion,
  refreshMuseumScrollAnimations
} from "./museum-motion";

type FilterId = "all" | ArtifactCategory;

let activeFilter: FilterId = "all";
let dialogClosing = false;

const artifactCount = document.querySelector<HTMLElement>("#artifact-count");
const categoryCount = document.querySelector<HTMLElement>("#category-count");
const featuredGallery = document.querySelector<HTMLElement>("#featured-gallery");
const filterBar = document.querySelector<HTMLElement>("#filter-bar");
const collectionGrid = document.querySelector<HTMLElement>("#collection-grid");
const dialog = document.querySelector<HTMLDialogElement>("#artifact-dialog");
const dialogBody = document.querySelector<HTMLElement>("#dialog-body");
const dialogClose = document.querySelector<HTMLButtonElement>(".dialog-close");

function setCoverStyle(element: HTMLElement, artifact: Artifact) {
  element.style.setProperty("--cover-from", artifact.palette.from);
  element.style.setProperty("--cover-via", artifact.palette.via);
  element.style.setProperty("--cover-to", artifact.palette.to);
  element.style.setProperty("--cover-accent", artifact.palette.accent);
}

function createImageElement(src: string, alt: string) {
  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  return image;
}

function artifactCard(artifact: Artifact, variant: "featured" | "standard") {
  const article = document.createElement("article");
  article.className = `artifact-card corner-flourish ${variant === "featured" ? "is-featured" : ""}`;
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
  cover.append(createImageElement(artifact.coverImage, artifact.coverAlt));
  cover.insertAdjacentHTML("beforeend", `<span class="cover-symbol" aria-hidden="true">${artifact.symbol}</span>`);

  const body = document.createElement("div");
  body.className = "artifact-body";
  body.innerHTML = `
    <p class="artifact-volume">Volume ${artifact.volume}</p>
    <h3>${artifact.title}</h3>
    <p class="artifact-meta">${artifact.categoryLabel} · ${artifact.year}</p>
    <p>${artifact.summary}</p>
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
      renderFilters();
      renderCollection();
      requestAnimationFrame(refreshMuseumScrollAnimations);
    });
    filterBar.append(button);
  });
}

export function renderCollection() {
  if (!collectionGrid) return;

  const visibleArtifacts =
    activeFilter === "all" ? artifacts : artifacts.filter((artifact) => artifact.category === activeFilter);

  collectionGrid.replaceChildren(...visibleArtifacts.map((artifact) => artifactCard(artifact, "standard")));
}

function renderFeatured() {
  if (!featuredGallery) return;
  const featured = artifacts.filter((artifact) => artifact.featured);
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
  cover.append(createImageElement(artifact.coverImage, artifact.coverAlt));
  cover.insertAdjacentHTML("beforeend", `<span class="cover-symbol" aria-hidden="true">${artifact.symbol}</span>`);

  const copy = document.createElement("div");
  copy.className = "dialog-copy";
  copy.innerHTML = `
    <p class="volume-label">Volume ${artifact.volume}</p>
    <h2 id="dialog-title">${artifact.title}</h2>
    <dl class="artifact-ledger">
      <div><dt>类别</dt><dd>${artifact.categoryLabel}</dd></div>
      <div><dt>年份</dt><dd>${artifact.year}</dd></div>
      <div><dt>媒介</dt><dd>${artifact.medium}</dd></div>
      <div><dt>标记</dt><dd>${artifact.rarity}</dd></div>
    </dl>
    <p class="dialog-summary">${artifact.summary}</p>
    <p>${artifact.note}</p>
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

function updateCounts() {
  if (artifactCount) artifactCount.textContent = String(artifacts.length).padStart(2, "0");
  if (categoryCount) categoryCount.textContent = String(categories.length - 1).padStart(2, "0");
}

function initMuseum() {
  updateCounts();
  renderFeatured();
  renderFilters();
  renderCollection();
  bindDialogEvents();
  initMuseumMotion();
}

initMuseum();
