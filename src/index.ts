// The Apivant app-switcher registry - ONE definition of which apps exist,
// what they're called, and where they live, consumed by every family app's
// AppRail.
//
// This exists because the previous arrangement (a hand-mirrored copy in each
// app, with a comment in each asking the next person to remember) desynced
// exactly as predicted: Vantage shipped at vantage.apivant.io and both
// VantSign and Services Builder went on rendering it as a dead "Coming soon"
// tile. A tile pointing at the wrong place is worse than no tile.
//
// Per-app variance is a PARAMETER, not a fork: the only real differences were
// which entry is the active app and what local path its own tile points at.
// createAppRegistry() takes both and returns the same API surface each app
// already used, so a consumer swaps its local file for one call.
import { Handshake, ShieldCheck, Signature, UserSearch, Wrench, type LucideIcon } from "lucide-react";

/** Every app in the family. Adding one starts here. */
export type AppId = "fulcrum" | "services-builder" | "vantsign" | "vantage" | "staffing-portal";

// How an app entry gets rendered by AppRail / a mobile drawer's app-switcher
// section. "internal" is a same-app route (the app you're standing in);
// "external" is a separate deployment reached over a plain link;
// "coming_soon" has no destination yet.
export type AppKind = "internal" | "external" | "coming_soon";

/**
 * Generic over the consuming app's own user type, because each app models its
 * viewer differently (VantSign has a local `User`, Services Builder imports
 * one from its schema, Vantage uses `Me`). Nothing gates on it today -
 * `checkAccess` is the extension point for per-app entitlements.
 */
export interface AppEntry<TUser = unknown> {
  /** Stable key. Drives data-testids - do not reuse across entries. */
  id: AppId;
  /** Tooltip / drawer label, e.g. "Services Builder". */
  name: string;
  icon: LucideIcon;
  kind: AppKind;
  /** internal -> local route path; external -> absolute URL. Omitted for
   *  "coming_soon" (and treated as disabled if missing on any other kind). */
  href?: string;
  /** external only. Defaults to "_blank" - these are stateful SPAs, and the
   *  switcher is for working ACROSS apps rather than leaving this one. */
  target?: "_blank" | "_self";
  /** Omitted means every authenticated viewer sees the tile. */
  checkAccess?: (user: TUser | undefined) => boolean;
  /** Tooltip second line, e.g. "Coming soon". */
  tagline?: string;
}

/** Where each app lives when you're NOT standing in it. The single place a
 *  URL change has to land. VantSign's is the authenticated staff app, NOT
 *  /sign/:token (the public tokenized signer plane, which has no session). */
export const APP_HOME: Record<AppId, string> = {
  fulcrum: "https://fulcrum.apivant.io",
  // Custom domain, NOT the servicebuilder.replit.app address this used to
  // carry: Services Builder moved to Render, and the Replit deployment still
  // answers 200 with the pre-migration app. A stale-but-live URL is the worst
  // kind - nothing 404s, the rail just quietly lands everyone on a zombie.
  "services-builder": "https://servicebuilder.apivant.io",
  vantsign: "https://vantsign.apivant.io/app",
  vantage: "https://vantage.apivant.io",
  // Staff surface only. The portal's /partner/* plane is for external agency
  // recruiters and never renders the family rail - this URL is where STAFF land.
  "staffing-portal": "https://staffing.apivant.io",
};

/** Canonical rail order, identical in every app so the switcher looks the
 *  same everywhere and only the highlight moves. */
const CATALOG: { id: AppId; name: string; icon: LucideIcon }[] = [
  { id: "fulcrum", name: "Fulcrum", icon: ShieldCheck },
  { id: "services-builder", name: "Services Builder", icon: Wrench },
  { id: "vantsign", name: "VantSign", icon: Signature },
  { id: "vantage", name: "Vantage", icon: Handshake },
  { id: "staffing-portal", name: "Staffing Portal", icon: UserSearch },
];

export interface AppRegistryOptions {
  /** The app this build IS. Its tile becomes the internal one. */
  activeAppId: AppId;
  /** Local route for the active app's own tile. Defaults to "/" - VantSign
   *  mounts its staff SPA at "/app". */
  activeHref?: string;
  /** Apps that exist in the catalog but aren't reachable yet. An entry listed
   *  here renders as a disabled "Coming soon" tile instead of a link. */
  comingSoon?: readonly AppId[];
}

export interface AppRegistry<TUser = unknown> {
  APP_ENTRIES: AppEntry<TUser>[];
  ACTIVE_APP_ID: AppId;
  visibleApps: (user: TUser | undefined) => AppEntry<TUser>[];
  isActiveApp: (entry: AppEntry<TUser>) => boolean;
  appLinkBehavior: (entry: AppEntry<TUser>) => AppLinkBehavior;
}

export type AppLinkBehavior = "internal-link" | "external-link" | "disabled";

/** What the tile should render as. Centralized so flipping an entry's kind
 *  (a sibling going live) never requires touching AppRail's render logic. */
export function appLinkBehavior<TUser>(entry: AppEntry<TUser>): AppLinkBehavior {
  if (entry.kind === "coming_soon" || !entry.href) return "disabled";
  return entry.kind === "external" ? "external-link" : "internal-link";
}

/**
 * Build one app's view of the rail. Returns the same names each app's local
 * registry exported, so consumers keep calling `visibleApps(user)` etc.
 * unchanged.
 */
export function createAppRegistry<TUser = unknown>(
  options: AppRegistryOptions,
): AppRegistry<TUser> {
  const { activeAppId, activeHref = "/", comingSoon = [] } = options;

  const APP_ENTRIES: AppEntry<TUser>[] = CATALOG.map(({ id, name, icon }) => {
    if (id === activeAppId) {
      return { id, name, icon, kind: "internal", href: activeHref };
    }
    if (comingSoon.includes(id)) {
      return { id, name, icon, kind: "coming_soon", tagline: "Coming soon" };
    }
    return { id, name, icon, kind: "external", href: APP_HOME[id], target: "_blank" };
  });

  return {
    APP_ENTRIES,
    ACTIVE_APP_ID: activeAppId,
    visibleApps: (user) =>
      APP_ENTRIES.filter((app) => (app.checkAccess ? app.checkAccess(user) : true)),
    isActiveApp: (entry) => entry.id === activeAppId,
    appLinkBehavior,
  };
}
