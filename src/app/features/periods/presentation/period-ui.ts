/**
 * Clases de Tailwind que repiten los componentes del cierre, para que botones y superficies se vean
 * igual en el selector, el aviso, el panel y el modal.
 */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ig-accent';

export const PERIOD_UI = {
  primary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ig-accent bg-ig-accent px-5 text-[14px] font-bold text-ig-on-accent hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`,
  secondary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ig-border bg-transparent px-4 text-[14px] font-medium text-ig-text hover:bg-ig-surface-raised disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`,
  accentOutline: `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ig-accent bg-transparent px-4 text-[14px] font-bold text-ig-accent-text hover:bg-ig-accent/10 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`,
  link: `inline-flex min-h-11 items-center gap-1 rounded-lg bg-transparent px-2 text-[14px] font-bold text-ig-accent-text underline-offset-4 hover:underline ${FOCUS}`,
  icon: `inline-grid size-11 shrink-0 place-items-center rounded-lg border border-transparent bg-transparent text-ig-muted hover:bg-ig-surface-raised hover:text-ig-text disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`,
  focus: FOCUS,
} as const;
