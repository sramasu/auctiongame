// jsdom environment for the UI integration test. Must run before the bundle.
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://127.0.0.1:3000/",
  pretendToBeVisual: true,
});

const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true, writable: true });
globalThis.location = window.location;
globalThis.localStorage = window.localStorage;
globalThis.sessionStorage = window.sessionStorage;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.getComputedStyle = window.getComputedStyle;
for (const key of [
  "SVGElement", "HTMLInputElement", "HTMLButtonElement", "HTMLDivElement", "HTMLSpanElement",
  "DocumentFragment", "DOMParser", "XMLSerializer", "SVGGraphicsElement", "HTMLCanvasElement",
  "CanvasRenderingContext2D", "ImageData", "Blob", "File", "FileReader", "URL", "URLSearchParams",
  "XMLHttpRequest", "FormData", "Headers", "Request", "Response", "AbortController",
  "MutationObserver", "PerformanceObserver", "DOMRect", "Range", "Text", "Comment", "NodeList",
  "HTMLCollection", "ShadowRoot", "CSS", "performance",
]) {
  if (window[key] !== undefined && globalThis[key] === undefined) globalThis[key] = window[key];
}
globalThis.performance = globalThis.performance || window.performance;
// Node's undici WebSocket clashes with jsdom Events — force the jsdom one.
Object.defineProperty(globalThis, "WebSocket", { value: window.WebSocket, configurable: true, writable: true });
Object.defineProperty(globalThis, "XMLHttpRequest", { value: window.XMLHttpRequest, configurable: true, writable: true });
// framer-motion passes an AbortSignal into jsdom listeners: realms must match.
for (const key of ["AbortController", "AbortSignal", "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "TouchEvent", "PointerEvent"]) {
  if (window[key] !== undefined) {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
  }
}
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
window.scrollTo = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
globalThis.matchMedia = window.matchMedia;

class IO {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this); }
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
globalThis.IntersectionObserver = IO;
window.IntersectionObserver = IO;

class RO {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ target: el, contentRect: { width: 1280, height: 800 } }], this); }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = RO;
window.ResizeObserver = RO;

// Silence noisy css-animation lookups jsdom cannot resolve.
const origError = console.error;
console.error = (...args) => {
  const msg = String(args[0] || "");
  if (/not wrapped in act|useLayoutEffect does nothing|Could not parse CSS/i.test(msg)) return;
  origError(...args);
};

export { window };
export const document = window.document;
