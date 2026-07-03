import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const desktopMotionQuery = window.matchMedia("(min-width: 760px)");

function shouldReduceMotion() {
  return reduceMotionQuery.matches;
}

function motionElements<T extends Element>(selector: string, root: ParentNode = document) {
  return Array.from(root.querySelectorAll<T>(selector));
}

function isHiddenByRoute(element: HTMLElement) {
  return element.hidden || element.closest("[hidden]") !== null;
}

function killMuseumScrollTriggers() {
  ScrollTrigger.getAll().forEach((trigger) => {
    if (typeof trigger.vars.id === "string" && trigger.vars.id.startsWith("museum-")) {
      trigger.kill();
    }
  });
}

function revealAllMotionElements() {
  gsap.set("[data-motion-title], [data-motion-item], [data-motion-image], [data-motion-ledger], .section-heading, .note-ledger", {
    autoAlpha: 1,
    clearProps: "transform,clipPath,filter"
  });
}

function resetMotionElements() {
  motionElements<HTMLElement>(".motion-reveal, [data-motion-title], [data-motion-item], [data-motion-image], [data-motion-ledger], .section-heading, .note-ledger").forEach((element) => {
    element.classList.remove("motion-reveal");
  });

  revealAllMotionElements();
}

function initAmbientMotion() {
  const atmosphere = document.querySelector<HTMLElement>("[data-motion-ambient]");
  if (!atmosphere) return;

  gsap.to(atmosphere, {
    "--museum-light-x": "76%",
    "--museum-light-y": "30%",
    duration: 20,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true
  });

  gsap.to(".vignette", {
    opacity: 0.78,
    duration: 9,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true
  });

  if (!desktopMotionQuery.matches) return;

  let pointerTween: gsap.core.Tween | undefined;

  window.addEventListener("pointermove", (event) => {
    pointerTween?.kill();
    pointerTween = gsap.to(atmosphere, {
      "--museum-light-x": `${Math.round((event.clientX / window.innerWidth) * 100)}%`,
      "--museum-light-y": `${Math.round((event.clientY / window.innerHeight) * 100)}%`,
      duration: 1.6,
      ease: "power3.out"
    });
  });
}

function initOpeningTimeline() {
  const hero = document.querySelector<HTMLElement>("[data-motion-hero]");
  if (!hero || isHiddenByRoute(hero)) return;

  const title = hero.querySelector<HTMLElement>("[data-motion-title]");
  const volume = hero.querySelector<HTMLElement>(".volume-label");
  const lede = hero.querySelector<HTMLElement>(".hero-lede");
  const actions = hero.querySelector<HTMLElement>(".hero-actions");
  const cabinet = hero.querySelector<HTMLElement>(".hero-cabinet");
  const headerItems = motionElements<HTMLElement>(".brand-mark, .site-nav a");

  gsap.timeline({ defaults: { ease: "power3.out" } })
    .from(headerItems, { autoAlpha: 0, y: -12, duration: 0.7, stagger: 0.08 })
    .from(volume, { autoAlpha: 0, y: 14, duration: 0.48 }, "-=0.28")
    .from(title, { autoAlpha: 0, y: 28, filter: "blur(4px)", duration: 0.72 }, "-=0.2")
    .from(lede, { autoAlpha: 0, y: 20, duration: 0.62 }, "-=0.42")
    .from(actions, { autoAlpha: 0, y: 16, duration: 0.54 }, "-=0.42")
    .from(cabinet, { autoAlpha: 0, y: 24, scale: 0.985, filter: "blur(5px)", duration: 0.72 }, "-=0.48");
}

function initWaxSealMotion() {
  gsap.to(".wax-seal", {
    scale: 1.035,
    rotate: 1.2,
    duration: 3.8,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true
  });
}

function initSectionTimeline(section: HTMLElement, index: number) {
  const heading = section.querySelector<HTMLElement>(".section-heading, .note-ledger");
  const title = section.querySelector<HTMLElement>("[data-motion-title]");
  const items = motionElements<HTMLElement>("[data-motion-item]", section);
  const images = motionElements<HTMLElement>("[data-motion-image]", section);

  const timeline = gsap.timeline({
    scrollTrigger: {
      id: `museum-section-${index}`,
      trigger: section,
      start: "top 78%",
      once: true
    },
    defaults: { ease: "power3.out", immediateRender: false }
  });

  if (heading) {
    timeline.from(heading, { autoAlpha: 0, y: 28, duration: 0.72 });
  }

  if (title) {
    timeline.from(title, { autoAlpha: 0, y: 30, clipPath: "inset(0 0 100% 0)", duration: 0.74 }, heading ? "-=0.48" : 0);
  }

  if (images.length > 0) {
    timeline.from(images, { autoAlpha: 0, scale: 1.035, clipPath: "inset(12% 0 12% 0)", duration: 0.86, stagger: 0.08 }, "-=0.32");
  }

  if (items.length > 0) {
    timeline.from(items, { autoAlpha: 0, y: 28, duration: 0.78, stagger: 0.1 }, "-=0.44");
  }
}

function initDividerTimelines() {
  motionElements<HTMLElement>(".ornate-divider").forEach((divider, index) => {
    if (isHiddenByRoute(divider)) return;

    gsap.fromTo(
      divider,
      { autoAlpha: 0.35, scaleX: 0.68 },
      {
        autoAlpha: 1,
        scaleX: 1,
        duration: 1.1,
        ease: "power3.out",
        immediateRender: false,
        scrollTrigger: {
          id: `museum-divider-${index}`,
          trigger: divider,
          start: "top 86%",
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
      yPercent: index === 0 ? -4 : -2,
      ease: "none",
      scrollTrigger: {
        id: `museum-parallax-${index}`,
        trigger: element,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.8
      }
    });
  });
}

export function refreshMuseumScrollAnimations() {
  killMuseumScrollTriggers();
  resetMotionElements();

  if (shouldReduceMotion()) {
    return;
  }

  motionElements<HTMLElement>("[data-motion-item], [data-motion-image], [data-motion-title]").forEach((element) => {
    element.classList.add("motion-reveal");
  });

  motionElements<HTMLElement>("[data-motion-section]").forEach((section, index) => {
    if (section.matches(".site-header")) return;
    if (isHiddenByRoute(section)) return;
    initSectionTimeline(section, index);
  });

  initDividerTimelines();
  initDesktopParallax();
  ScrollTrigger.refresh();
}

export function animateArtifactDialog(dialog: HTMLDialogElement) {
  if (shouldReduceMotion()) {
    revealAllMotionElements();
    return;
  }

  const cover = dialog.querySelector<HTMLElement>("[data-motion-image]");
  const ledger = motionElements<HTMLElement>("[data-motion-ledger]", dialog);
  const gallery = motionElements<HTMLElement>(".image-plate", dialog);

  gsap.timeline({ defaults: { ease: "power3.out" } })
    .fromTo(dialog, { autoAlpha: 0, y: 18, scale: 0.985, filter: "blur(6px)" }, { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.38 })
    .from(cover, { autoAlpha: 0, y: 18, scale: 1.025, clipPath: "inset(10% 0 10% 0)", duration: 0.58 }, "-=0.18")
    .from(ledger, { autoAlpha: 0, y: 14, duration: 0.42, stagger: 0.06 }, "-=0.28")
    .from(gallery, { autoAlpha: 0, y: 14, clipPath: "inset(0 0 100% 0)", duration: 0.48, stagger: 0.08 }, "-=0.2");
}

export function animateArtifactDialogClose(dialog: HTMLDialogElement, onComplete = () => undefined) {
  if (shouldReduceMotion()) {
    onComplete();
    return;
  }

  gsap.to(dialog, {
    autoAlpha: 0,
    y: 12,
    scale: 0.992,
    duration: 0.24,
    ease: "power2.out",
    onComplete: () => {
      gsap.set(dialog, { clearProps: "opacity,visibility,transform,filter" });
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

  initAmbientMotion();
  initOpeningTimeline();
  initWaxSealMotion();
  refreshMuseumScrollAnimations();
}
