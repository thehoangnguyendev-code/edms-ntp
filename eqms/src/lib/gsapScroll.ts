import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gsap } from './gsap';

/**
 * ScrollTrigger for the application. Every page scrolls inside `#main-scroll-container`, not the window, so ScrollTrigger is pointed at it by default.
 * A trigger inside another scroller (a table, a panel) passes its own `scroller`. Import it from here, not from `gsap/ScrollTrigger`.
 */
export const PAGE_SCROLLER = '#main-scroll-container';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.defaults({ scroller: PAGE_SCROLLER });

export { ScrollTrigger };
