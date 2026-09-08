import { describe, expect, it } from "vitest";
import { getRedirectPath, isInTrackDir } from "./guards";

describe("getRedirectPath", () => {
	it("redirects bare track file names into .pi/track/", () => {
		expect(getRedirectPath("findings.md", "/repo")).toBe("/repo/.pi/track/findings.md");
		expect(getRedirectPath("progress.md", "/repo")).toBe("/repo/.pi/track/progress.md");
	});

	it("leaves already-correct paths untouched", () => {
		expect(getRedirectPath("/repo/.pi/track/findings.md", "/repo")).toBeUndefined();
	});

	it("leaves unrelated files untouched", () => {
		expect(getRedirectPath("src/findings-service.ts", "/repo")).toBeUndefined();
		expect(getRedirectPath("docs/progress-report.md", "/repo")).toBeUndefined();
	});
});

describe("isInTrackDir", () => {
	it("accepts paths inside the dir", () => {
		expect(isInTrackDir(".pi/track/findings.md", "/repo")).toBe(true);
		expect(isInTrackDir("/repo/.pi/track", "/repo")).toBe(true);
	});

	it("rejects sibling dirs and traversal escapes", () => {
		expect(isInTrackDir(".pi/wayfinder/tickets/001.md", "/repo")).toBe(false);
		expect(isInTrackDir(".pi/track/../other/file.md", "/repo")).toBe(false);
	});
});
