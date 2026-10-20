// Reuse the existing A-share page's React instance; never install a second root.
const React=(window as any).React;
export const useState=React.useState as typeof import('react').useState;
export const useMemo=React.useMemo as typeof import('react').useMemo;
export default React;
