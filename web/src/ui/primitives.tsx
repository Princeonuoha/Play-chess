/* ---------------------------------------------------------------------------
 * The DESIGN.md Section 7 primitive barrel.
 *
 * Section 7.4 rule 1: "A primitive is defined once in `web/src/ui/` and
 * imported. Re-implementing a primitive's visuals inside a panel is a defect."
 * Every panel therefore imports from here. The implementations are split by
 * concern so no single module grows past reviewable size, and the visual
 * contract lives once in `./primitives.css`, which `../index.css` imports.
 *
 * `Icon` and `IconButton` are re-exported rather than redefined: DESIGN.md 5.1
 * makes `./icons.tsx` the single icon source and `scripts/verify-icons.mjs`
 * fails any `<svg>` authored outside it.
 * ------------------------------------------------------------------------- */

export { Btn, Field, GroupedSelect, Slider, type FieldControl, type Group } from './controls'
export { Icon, IconButton, IconLabel, type IconName, type IconSize } from './icons'
export { Surface, SegmentedNav, type SegmentItem } from './surfaces'
export { EngineStatus, StatusNote, InlineFeedback, Loading, Empty, Error } from './feedback'
export { DialogSurface, Toast, ToastRegion, type ToastMessage, type ToastTone } from './overlays'
