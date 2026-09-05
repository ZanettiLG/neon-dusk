// slug → bundled icon asset URL for cromo items (issue #188 emenda 1).
// Empty during #188: the 12 item icons are the sub-issue of epic #189
// (asset-forge). Populating this map is a zero-diff delivery — ChromeIcon
// already renders <img> when the slug has an entry and falls back to the
// tier monogram when it doesn't (or when the image fails to load).
export const CHROME_ICON_ASSETS: Record<string, string> = {};
