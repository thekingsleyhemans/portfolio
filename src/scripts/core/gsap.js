import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof document !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export { ScrollTrigger, SplitText };
export default gsap;