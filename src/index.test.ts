import { describe, expect, it } from "vitest";
import {
  APP_HOME,
  appLinkBehavior,
  createAppRegistry,
  type AppEntry,
  type AppId,
} from "./index";

const ALL_APPS: AppId[] = ["fulcrum", "services-builder", "vantsign", "vantage"];

describe("createAppRegistry", () => {
  it("marks exactly one entry internal - the active app", () => {
    for (const activeAppId of ALL_APPS) {
      const { APP_ENTRIES } = createAppRegistry({ activeAppId });
      const internal = APP_ENTRIES.filter((e) => e.kind === "internal");
      expect(internal).toHaveLength(1);
      expect(internal[0].id).toBe(activeAppId);
    }
  });

  it("points the active tile at the app's own local path", () => {
    const vantsign = createAppRegistry({ activeAppId: "vantsign", activeHref: "/app" });
    expect(vantsign.APP_ENTRIES.find((e) => e.id === "vantsign")?.href).toBe("/app");
    // Apps mounted at the root don't have to say so.
    const vantage = createAppRegistry({ activeAppId: "vantage" });
    expect(vantage.APP_ENTRIES.find((e) => e.id === "vantage")?.href).toBe("/");
  });

  it("renders every non-active app as an external link to its canonical home", () => {
    const { APP_ENTRIES } = createAppRegistry({ activeAppId: "vantsign" });
    for (const entry of APP_ENTRIES.filter((e) => e.id !== "vantsign")) {
      expect(entry.kind).toBe("external");
      expect(entry.href).toBe(APP_HOME[entry.id]);
      expect(entry.target).toBe("_blank");
    }
  });

  // The bug this package exists to prevent: a shipped app advertised as a
  // dead tile because one copy of the registry never got updated. There is
  // now one copy, and "coming soon" is an explicit opt-in per build.
  it("only treats an app as coming_soon when explicitly told to", () => {
    const withNone = createAppRegistry({ activeAppId: "vantsign" });
    expect(withNone.APP_ENTRIES.some((e) => e.kind === "coming_soon")).toBe(false);

    const withOne = createAppRegistry({ activeAppId: "vantsign", comingSoon: ["vantage"] });
    const vantage = withOne.APP_ENTRIES.find((e) => e.id === "vantage")!;
    expect(vantage.kind).toBe("coming_soon");
    expect(vantage.href).toBeUndefined();
    expect(appLinkBehavior(vantage)).toBe("disabled");
  });

  it("keeps identical rail order in every app so only the highlight moves", () => {
    const orders = ALL_APPS.map((activeAppId) =>
      createAppRegistry({ activeAppId }).APP_ENTRIES.map((e) => e.id).join(","),
    );
    expect(new Set(orders).size).toBe(1);
  });

  it("isActiveApp identifies only the active app", () => {
    const { APP_ENTRIES, isActiveApp, ACTIVE_APP_ID } = createAppRegistry({
      activeAppId: "services-builder",
    });
    expect(ACTIVE_APP_ID).toBe("services-builder");
    expect(APP_ENTRIES.filter(isActiveApp).map((e) => e.id)).toEqual(["services-builder"]);
  });

  it("has unique ids and a non-empty name and icon per entry", () => {
    const { APP_ENTRIES } = createAppRegistry({ activeAppId: "fulcrum" });
    expect(new Set(APP_ENTRIES.map((e) => e.id)).size).toBe(APP_ENTRIES.length);
    for (const e of APP_ENTRIES) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.icon).toBeTruthy();
    }
  });

  it("filters tiles through checkAccess when a consumer sets one", () => {
    interface Viewer {
      admin: boolean;
    }
    const reg = createAppRegistry<Viewer>({ activeAppId: "vantsign" });
    reg.APP_ENTRIES.find((e) => e.id === "fulcrum")!.checkAccess = (u) => !!u?.admin;

    expect(reg.visibleApps({ admin: true }).map((e) => e.id)).toContain("fulcrum");
    expect(reg.visibleApps({ admin: false }).map((e) => e.id)).not.toContain("fulcrum");
    // Undefined viewer must not throw - the rail renders before auth resolves.
    expect(reg.visibleApps(undefined).map((e) => e.id)).not.toContain("fulcrum");
  });
});

describe("APP_HOME", () => {
  // The package exists so a URL change lands in ONE place. That only helps if
  // the URLs in it are the canonical ones - and the first bug found after
  // extraction was a Services Builder tile still pointing at the retired
  // servicebuilder.replit.app, which answers 200 with the pre-migration app.
  // A dead host would have been caught by anyone clicking it; a live-but-wrong
  // host is invisible. So: every app is reachable at an apivant.io name, and
  // no entry may point at a PaaS default domain.
  it("addresses every app by its apivant.io domain", () => {
    for (const id of ALL_APPS) {
      expect(new URL(APP_HOME[id]).hostname.endsWith(".apivant.io")).toBe(true);
    }
  });

  it("points at no PaaS default domain", () => {
    const paasHosts = [".replit.app", ".onrender.com", ".vercel.app", ".netlify.app"];
    for (const id of ALL_APPS) {
      const host = new URL(APP_HOME[id]).hostname;
      for (const bad of paasHosts) {
        expect(host.endsWith(bad), `${id} points at ${host}`).toBe(false);
      }
    }
  });

  it("uses https everywhere", () => {
    for (const id of ALL_APPS) {
      expect(new URL(APP_HOME[id]).protocol).toBe("https:");
    }
  });
});

describe("appLinkBehavior", () => {
  it("maps kind to how the tile renders", () => {
    const { APP_ENTRIES } = createAppRegistry({ activeAppId: "vantsign" });
    expect(appLinkBehavior(APP_ENTRIES.find((e) => e.id === "vantsign")!)).toBe("internal-link");
    expect(appLinkBehavior(APP_ENTRIES.find((e) => e.id === "fulcrum")!)).toBe("external-link");
  });

  it("disables a half-filled row rather than rendering a link to nowhere", () => {
    const halfFilled = {
      id: "fulcrum",
      name: "Fulcrum",
      icon: createAppRegistry({ activeAppId: "vantsign" }).APP_ENTRIES[0].icon,
      kind: "external",
    } as AppEntry;
    expect(appLinkBehavior(halfFilled)).toBe("disabled");
  });
});
