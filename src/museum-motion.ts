import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const desktopMotionQuery = window.matchMedia("(min-width: 760px)");
let scrollMotionContext: gsap.Context | null = null;
let ambientTimeline: gsap.core.Timeline | null = null;
let entryTimeline: gsap.core.Timeline | null = null;
let dialogTimeline: gsap.core.Timeline | null = null;
let collectionTimeline: gsap.core.Timeline | null = null;
let routeTimeline: gsap.core.Timeline | null = null;
let motionInitialized = false;
let pointerFrame = 0;
let pointerX = 0;
let pointerY = 0;

function shouldReduceMotion() {
  return reduceMotionQuery.matches;
}

function motionElements<T extends Element>(selector: string, root: ParentNode = document) {
  return Array.from(root.querySelectorAll<T>(selector));
}

function isHiddenByRoute(element: HTMLElement) {
  return element.hidden || element.closest("[hidden]") !== null;
}

function clearMotionProps(elements: Element[]) {
  if (elements.length === 0) return;
  gsap.set(elements, { clearProps: "opacity,visibility,transform,clipPath,filter,willChange" });
  elements.forEach((element) => element.classList.remove("motion-reveal"));
}

function prepareMotionElements(elements: Element[]) {
  elements.forEach((element) => element.classList.add("motion-reveal"));
}

function killMuseumScrollAnimations() {
  scrollMotionContext?.revert();
  scrollMotionContext = null;
  collectionTimeline?.kill();
  collectionTimeline = null;
  clearMotionProps(motionElements<HTMLElement>("#collection-grid > [data-motion-item]"));

  ScrollTrigger.getAll().forEach((trigger) => {
    if (typeof trigger.vars.id === "string" && trigger.vars.id.startsWith("museum-")) {
      trigger.kill();
    }
  });
}

function routeMotionGroups(section: HTMLElement) {
  if (section.matches("[data-motion-hero]")) {
    const intro = motionElements<HTMLElement>(
      ":scope > .hero-copy > .volume-label, :scope > .hero-copy > [data-motion-title], :scope > .hero-copy > .hero-lede",
      section
    );
    const controls = motionElements<HTMLElement>(":scope > .hero-copy > .hero-actions", section);
    const content = motionElements<HTMLElement>(
      ":scope > .hero-cabinet > .hero-stage-card, :scope > .hero-cabinet > .museum-stats > div",
      section
    );
    return { intro, controls, content, all: [...intro, ...controls, ...content] };
  }

  const heading = section.querySelector<HTMLElement>(".section-heading");
  const intro = heading
    ? motionElements<HTMLElement>(":scope > .volume-label, :scope > [data-motion-title], :scope > p:not(.volume-label)", heading)
    : [];
  const controls = motionElements<HTMLElement>(
    ":scope > .category-index > *, :scope > .manager-search, :scope > .filter-bar > *, :scope > .management-panel > .auth-panel",
    section
  );
  const content = motionElements<HTMLElement>(
    ":scope > .featured-grid > [data-motion-item], :scope > .collection-grid > [data-motion-item], :scope > .management-panel > *:not(.auth-panel)",
    section
  );

  return { intro, controls, content, all: [...intro, ...controls, ...content] };
}

export function animateMuseumRoute(section: HTMLElement) {
  routeTimeline?.kill();
  routeTimeline = null;

  const groups = routeMotionGroups(section);
  clearMotionProps(groups.all);
  if (shouldReduceMotion() || groups.all.length === 0) return;

  prepareMotionElements(groups.all);
  if (groups.intro.length > 0) gsap.set(groups.intro, { autoAlpha: 0, y: 18 });
  if (groups.controls.length > 0) gsap.set(groups.controls, { autoAlpha: 0, y: 16 });
  if (groups.content.length > 0) gsap.set(groups.content, { autoAlpha: 0, y: 28, scale: 0.992 });

  routeTimeline = gsap.timeline({
    defaults: { ease: "power3.out" },
    onComplete: () => {
      clearMotionProps(groups.all);
      routeTimeline = null;
    }
  });

  if (groups.intro.length > 0) {
    routeTimeline.to(groups.intro, { autoAlpha: 1, y: 0, duration: 0.56, stagger: 0.075 });
  }
  if (groups.controls.length > 0) {
    routeTimeline.to(groups.controls, { autoAlpha: 1, y: 0, duration: 0.48, stagger: 0.055 }, groups.intro.length ? "-=0.16" : 0);
  }
  if (groups.content.length > 0) {
    routeTimeline.to(groups.content, { autoAlpha: 1, y: 0, scale: 1, duration: 0.68, stagger: 0.075 }, groups.controls.length ? "-=0.12" : "+=0.06");
  }
}

function revealAllMotionElements() {
  const elements = motionElements<HTMLElement>(
    ".motion-reveal, [data-motion-title], [data-motion-item], [data-motion-image], [data-motion-ledger], .section-heading, .note-ledger"
  );
  gsap.set(elements, { autoAlpha: 1, clearProps: "transform,clipPath,filter,willChange" });
  elements.forEach((element) => element.classList.remove("motion-reveal"));
}

function resetMotionElements() {
  revealAllMotionElements();
}

function syncLoopPlayback() {
  const shouldPause = document.hidden || shouldReduceMotion();
  ambientTimeline?.paused(shouldPause);
}

function handleMotionPreferenceChange() {
  entryTimeline?.kill();
  entryTimeline = null;
  dialogTimeline?.kill();
  dialogTimeline = null;

  if (shouldReduceMotion()) {
    killMuseumScrollAnimations();
    revealAllMotionElements();
    syncLoopPlayback();
    return;
  }

  refreshMuseumScrollAnimations();
  syncLoopPlayback();
}

function initAmbientMotion() {
  const atmosphere = document.querySelector<HTMLElement>("[data-motion-ambient]");
  const brassLight = document.querySelector<HTMLElement>("[data-motion-light]");
  const crimsonLight = document.querySelector<HTMLElement>("[data-motion-light-secondary]");
  const pointerLight = document.querySelector<HTMLElement>("[data-motion-pointer-light]");
  if (!atmosphere || !brassLight || !crimsonLight) return;

  ambientTimeline?.kill();
  gsap.set(brassLight, { xPercent: -34, yPercent: -38, force3D: true });
  gsap.set(crimsonLight, { xPercent: 38, yPercent: 26, force3D: true });

  ambientTimeline = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } })
    .to(brassLight, { xPercent: 18, yPercent: -18, duration: 18 }, 0)
    .to(crimsonLight, { xPercent: 12, yPercent: 42, duration: 22 }, 0)
    .to(".vignette", { opacity: 0.78, duration: 10 }, 0);

  if (!desktopMotionQuery.matches || !pointerLight) {
    syncLoopPlayback();
    return;
  }

  gsap.set(pointerLight, { xPercent: -50, yPercent: -50, force3D: true });
  const movePointerX = gsap.quickTo(pointerLight, "x", { duration: 1.25, ease: "power3.out" });
  const movePointerY = gsap.quickTo(pointerLight, "y", { duration: 1.25, ease: "power3.out" });
  const showPointerLight = gsap.quickTo(pointerLight, "opacity", { duration: 0.5, ease: "power2.out" });

  window.addEventListener("pointermove", (event) => {
    if (!desktopMotionQuery.matches || shouldReduceMotion()) return;
    pointerX = event.clientX - window.innerWidth / 2;
    pointerY = event.clientY - window.innerHeight / 2;
    if (pointerFrame) return;

    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      movePointerX(pointerX);
      movePointerY(pointerY);
      showPointerLight(0.78);
    });
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    showPointerLight(0);
  });
  syncLoopPlayback();
}

export function playMuseumEntry() {
  const hero = document.querySelector<HTMLElement>("[data-motion-hero]");
  if (!hero || isHiddenByRoute(hero) || document.body.dataset.accessRole === "locked") return;
  if (shouldReduceMotion()) {
    revealAllMotionElements();
    return;
  }

  entryTimeline?.kill();

  const headerItems = motionElements<HTMLElement>(".brand-mark, .site-nav a");
  const volume = hero.querySelector<HTMLElement>(".volume-label");
  const title = hero.querySelector<HTMLElement>("[data-motion-title]");
  const lede = hero.querySelector<HTMLElement>(".hero-lede");
  const actions = hero.querySelector<HTMLElement>(".hero-actions");
  const stage = hero.querySelector<HTMLElement>(".hero-stage-card");
  const stageCards = motionElements<HTMLElement>(".stage-card", hero);
  const caption = hero.querySelector<HTMLElement>(".stage-caption");
  const stats = motionElements<HTMLElement>(".museum-stats > div", hero);
  const animated = [hero, ...headerItems, volume, title, lede, actions, stage, ...stageCards, caption, ...stats]
    .filter((element): element is HTMLElement => Boolean(element));

  prepareMotionElements(animated);
  entryTimeline = gsap.timeline({
    defaults: { ease: "power4.out" },
    onComplete: () => {
      clearMotionProps(animated);
      entryTimeline = null;
    }
  })
    .from(hero, { autoAlpha: 0, clipPath: "inset(0 0 100% 0)", duration: 0.92, ease: "power4.inOut" })
    .from(headerItems, { autoAlpha: 0, y: -14, duration: 0.62, stagger: 0.06 }, 0.16)
    .from(volume, { autoAlpha: 0, y: 14, duration: 0.46 }, 0.36)
    .from(title, { autoAlpha: 0, y: 34, duration: 0.74 }, 0.44)
    .from(lede, { autoAlpha: 0, y: 22, duration: 0.62 }, 0.58)
    .from(actions, { autoAlpha: 0, y: 18, duration: 0.54 }, 0.68)
    .from(stage, { autoAlpha: 0, y: 24, scale: 0.988, duration: 0.76 }, 0.44)
    .from(stageCards, { autoAlpha: 0, y: 34, scale: 0.94, duration: 0.68, stagger: 0.09 }, 0.56)
    .from(caption, { autoAlpha: 0, y: 16, duration: 0.48 }, 0.82)
    .from(stats, { autoAlpha: 0, y: 14, duration: 0.46, stagger: 0.06 }, 0.88);
}

function initSectionTimeline(section: HTMLElement, index: number) {
  const sectionHeading = section.querySelector<HTMLElement>(".section-heading");
  const noteLedger = section.querySelector<HTMLElement>(".note-ledger");
  const headingCopy = sectionHeading
    ? motionElements<HTMLElement>(":scope > .volume-label, :scope > p:not(.volume-label)", sectionHeading)
    : [];
  const title = section.querySelector<HTMLElement>("[data-motion-title]");
  const items = motionElements<HTMLElement>("[data-motion-item]", section);
  const images = motionElements<HTMLElement>("[data-motion-image]", section).filter((image) => {
    return !items.some((item) => item.contains(image));
  });
  const animated = [...headingCopy, title, noteLedger, ...images, ...items]
    .filter((element): element is HTMLElement => Boolean(element));

  prepareMotionElements(animated);
  if (headingCopy.length > 0) gsap.set(headingCopy, { autoAlpha: 0, y: 20 });
  if (title) gsap.set(title, { autoAlpha: 0, y: 28, clipPath: "inset(0 0 100% 0)" });
  if (noteLedger) gsap.set(noteLedger, { autoAlpha: 0, y: 24 });
  if (images.length > 0) gsap.set(images, { autoAlpha: 0, scale: 1.025, clipPath: "inset(9% 0 9% 0)" });
  if (items.length > 0) gsap.set(items, { autoAlpha: 0, y: 24 });

  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: "power4.out" },
    onComplete: () => clearMotionProps(animated)
  });

  if (headingCopy.length > 0) {
    timeline.to(headingCopy, { autoAlpha: 1, y: 0, duration: 0.58, stagger: 0.07 });
  }

  if (title) {
    timeline.to(title, { autoAlpha: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.72 }, headingCopy.length > 0 ? "-=0.3" : 0);
  }

  if (noteLedger) {
    timeline.to(noteLedger, { autoAlpha: 1, y: 0, duration: 0.68 }, title ? "-=0.4" : 0);
  }

  if (images.length > 0) {
    timeline.to(images, { autoAlpha: 1, scale: 1, clipPath: "inset(0% 0 0% 0)", duration: 0.78, stagger: 0.07 }, "-=0.3");
  }

  if (items.length > 0) {
    timeline.to(items, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.075 }, "-=0.4");
  }

  ScrollTrigger.create({
    id: `museum-section-${index}`,
    trigger: section,
    start: "top 80%",
    animation: timeline,
    once: true
  });
}

function initDividerTimelines() {
  motionElements<HTMLElement>(".ornate-divider").forEach((divider, index) => {
    if (isHiddenByRoute(divider)) return;

    gsap.fromTo(
      divider,
      { autoAlpha: 0.35, scaleX: 0.72 },
      {
        autoAlpha: 1,
        scaleX: 1,
        duration: 0.96,
        ease: "power4.out",
        immediateRender: false,
        onComplete: () => gsap.set(divider, { clearProps: "opacity,visibility,transform" }),
        scrollTrigger: {
          id: `museum-divider-${index}`,
          trigger: divider,
          start: "top 88%",
          once: true
        }
      }
    );
  });
}

function initDesktopParallax() {
  if (!desktopMotionQuery.matches) return;

  motionElements<HTMLElement>(".hero-cabinet, .curator-notes").forEach((element, index) => {
    if (isHiddenByRoute(element)) return;

    gsap.to(element, {
      yPercent: index === 0 ? -3 : -1.5,
      ease: "none",
      force3D: true,
      scrollTrigger: {
        id: `museum-parallax-${index}`,
        trigger: element,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.9
      }
    });
  });
}

export function refreshMuseumScrollAnimations(skipSection?: HTMLElement) {
  killMuseumScrollAnimations();
  resetMotionElements();

  if (shouldReduceMotion()) return;

  scrollMotionContext = gsap.context(() => {
    motionElements<HTMLElement>("[data-motion-section]").forEach((section, index) => {
      if (section.matches(".site-header") || section === skipSection || isHiddenByRoute(section)) return;
      initSectionTimeline(section, index);
    });

    initDividerTimelines();
    initDesktopParallax();
  });
  ScrollTrigger.refresh();
}

export function animateCollectionRefresh(container: HTMLElement) {
  const cards = motionElements<HTMLElement>(":scope > [data-motion-item]", container);
  collectionTimeline?.kill();
  clearMotionProps(cards);

  if (shouldReduceMotion() || cards.length === 0) return;

  prepareMotionElements(cards);
  collectionTimeline = gsap.timeline({
    onComplete: () => {
      clearMotionProps(cards);
      collectionTimeline = null;
    }
  }).fromTo(
    cards,
    { autoAlpha: 0, y: 16, scale: 0.992 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.46, stagger: 0.045, ease: "power3.out" }
  );
}

export function animateArtifactDialog(dialog: HTMLDialogElement) {
  dialogTimeline?.kill();
  if (shouldReduceMotion()) {
    revealAllMotionElements();
    return;
  }

  const cover = dialog.querySelector<HTMLElement>("[data-motion-image]");
  const ledger = motionElements<HTMLElement>("[data-motion-ledger]", dialog);
  const gallery = motionElements<HTMLElement>(".image-plate", dialog);
  const animated = [dialog, cover, ...ledger, ...gallery].filter((element): element is HTMLElement => Boolean(element));
  prepareMotionElements(animated);

  dialogTimeline = gsap.timeline({
    defaults: { ease: "power4.out" },
    onComplete: () => {
      clearMotionProps(animated);
      dialogTimeline = null;
    }
  })
    .fromTo(dialog, { autoAlpha: 0, y: 14, scale: 0.99 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4 })
    .from(cover, { autoAlpha: 0, y: 16, scale: 1.018, clipPath: "inset(8% 0 8% 0)", duration: 0.56 }, "-=0.2")
    .from(ledger, { autoAlpha: 0, y: 12, duration: 0.38, stagger: 0.055 }, "-=0.26")
    .from(gallery, { autoAlpha: 0, y: 12, clipPath: "inset(0 0 100% 0)", duration: 0.44, stagger: 0.07 }, "-=0.18");
}

export function animateArtifactDialogClose(dialog: HTMLDialogElement, onComplete = () => undefined) {
  dialogTimeline?.kill();
  dialogTimeline = null;

  if (shouldReduceMotion()) {
    onComplete();
    return;
  }

  gsap.to(dialog, {
    autoAlpha: 0,
    y: 10,
    scale: 0.994,
    duration: 0.22,
    ease: "power2.inOut",
    overwrite: true,
    onComplete: () => {
      gsap.set(dialog, { clearProps: "opacity,visibility,transform,filter,willChange" });
      dialog.classList.remove("motion-reveal");
      onComplete();
    }
  });
}

export function initMuseumMotion() {
  document.documentElement.classList.add("motion-ready");

  if (shouldReduceMotion()) {
    revealAllMotionElements();
    return;
  }

  if (!motionInitialized) {
    motionInitialized = true;
    initAmbientMotion();
    document.addEventListener("visibilitychange", syncLoopPlayback);
    reduceMotionQuery.addEventListener("change", handleMotionPreferenceChange);
  }

  refreshMuseumScrollAnimations();
  playMuseumEntry();
}
