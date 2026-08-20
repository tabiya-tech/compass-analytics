import { describe, expect, it } from "vitest";
import { MODULE_IDS } from "@/access/AccessContext";
import { moduleSectionElementId, rendersModulesInline, soleActiveModule } from "./utils";

const WHOLE_SUITE = [
  MODULE_IDS.BUILD_YOUR_PROFILE,
  MODULE_IDS.JOB_READINESS,
  MODULE_IDS.CAREER_EXPLORER,
  MODULE_IDS.JOBS,
];

describe("rendersModulesInline", () => {
  it("renders inline for single-module deployments", () => {
    expect(rendersModulesInline([MODULE_IDS.BUILD_YOUR_PROFILE])).toBe(true);
  });

  it("uses separate screen for multi-module deployments", () => {
    expect(rendersModulesInline([MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOBS])).toBe(false);
    expect(rendersModulesInline(WHOLE_SUITE)).toBe(false);
  });

  it("does not render inline when no modules are active", () => {
    expect(rendersModulesInline([])).toBe(false);
  });
});

describe("soleActiveModule", () => {
  it("returns the module id for single-module deployments", () => {
    expect(soleActiveModule([MODULE_IDS.JOBS])).toBe("jobs");
  });

  it("returns null when multiple or no modules are active", () => {
    expect(soleActiveModule(WHOLE_SUITE)).toBeNull();
    expect(soleActiveModule([])).toBeNull();
  });
});

describe("moduleSectionElementId", () => {
  it("derives section id from module id for scroll-spy and links", () => {
    expect(moduleSectionElementId(MODULE_IDS.JOBS)).toBe("module-section-jobs");
  });
});
