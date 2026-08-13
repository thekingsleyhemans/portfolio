console.log("APP LOADED");
import "./engines/marquee-engine.js";
import { initSplitEngine } from "./engines/split-engine";

export function initApp() {
  if (typeof window === "undefined") return null;
  return initSplitEngine();
}