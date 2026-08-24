# @apivant/app-registry

The app-switcher registry shared by the Apivant family apps - one definition of
which apps exist, what they're called, and where they live. Every app's
`AppRail` renders from this.

## Why it exists

Each app used to carry its own hand-mirrored copy, with a comment asking the
next person to remember to update the others. That desynced exactly as the
comments feared: Vantage shipped at `vantage.apivant.io` while VantSign and
Services Builder both went on rendering it as a dead "Coming soon" tile. A tile
pointing at the wrong place is worse than no tile.

The only genuine per-app differences were *which* entry is the current app and
*what local path* its own tile points at. Both are now parameters.

## Use

```bash
npm install "git+https://github.com/Apivant/apivant-app-registry.git#v1.0.0"
```

```ts
import { createAppRegistry } from "@apivant/app-registry";
import type { User } from "./your-user-type";

export const { APP_ENTRIES, ACTIVE_APP_ID, visibleApps, isActiveApp, appLinkBehavior } =
  createAppRegistry<User>({
    activeAppId: "vantsign",
    activeHref: "/app", // omit for apps mounted at "/"
  });
```

The returned names match what each app's local registry already exported, so
adopting it is a one-file swap - `AppRail` and friends keep calling
`visibleApps(user)` / `appLinkBehavior(entry)` unchanged.

`createAppRegistry` is generic over the consuming app's own user type, because
each app models its viewer differently (VantSign has a local `User`, Services
Builder imports one from its schema, Vantage uses `Me`). Nothing gates on it
today; `checkAccess` is the extension point for per-app entitlements.

## Changing the family

- **An app's URL changed** - edit `APP_HOME`.
- **A new app** - add to `AppId` and `CATALOG`. Consumers pick it up on upgrade.
- **An app isn't live yet** - each app passes `comingSoon: ["that-app"]` for as
  long as *it* wants to show the tile as disabled. It's an explicit opt-in per
  build rather than a default, so nothing silently advertises a shipped app as
  unavailable again.

## Consumers

| App | Registry call site |
|---|---|
| VantSign | `client/src/apps/staff/components/shell/appRegistry.ts` |
| Services Builder | `client/src/lib/appRegistry.ts` |
| Vantage | `client/src/components/layout/appRegistry.ts` |
| Fulcrum | `client/src/components/Layout/appRegistry.ts` - **not yet migrated**; its rail work was still on an unmerged branch when this package was extracted. |

Consumers pin a tag. Bumping one is a deliberate act per app, so a URL change
can't surprise a deployment mid-release.

## Development

```bash
npm install
npm test      # vitest
npm run build # tsc -> dist/
```

`prepare` runs the build automatically, which is what makes the git-dependency
install work: npm clones the repo, installs devDependencies, and runs `prepare`
to produce `dist/` before the consumer resolves `main`/`types`.
