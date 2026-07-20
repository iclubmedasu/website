import { describe, expect, it } from "vitest";
import {
    normalizeTemplateLayout,
    parseTemplateLayoutWording,
} from "../certificateLayoutWording";

describe("parseTemplateLayoutWording", () => {
    it("returns empty wording for non-array layout", () => {
        expect(parseTemplateLayoutWording(null)).toEqual({
            description: "",
            issuerName: "",
            titleText: "",
            hasDescription: false,
            hasIssuer: false,
            hasTitle: false,
            staticTexts: [],
        });
    });

    it("extracts description, issuer, title, and numbered static texts", () => {
        const wording = parseTemplateLayoutWording([
            { id: "d1", type: "field", field: "description", text: "attended the conference" },
            { id: "i1", type: "field", field: "issuerName", text: "iClub" },
            { id: "t1", type: "field", field: "title", text: "Certificate of Merit" },
            { id: "s1", type: "static", text: "First block" },
            { id: "s2", type: "static", text: "Second block" },
            { id: "n1", type: "field", field: "recipientName" },
        ]);

        expect(wording).toEqual({
            description: "attended the conference",
            issuerName: "iClub",
            titleText: "Certificate of Merit",
            hasDescription: true,
            hasIssuer: true,
            hasTitle: true,
            staticTexts: [
                { id: "s1", text: "First block", ordinal: 1 },
                { id: "s2", text: "Second block", ordinal: 2 },
            ],
        });
    });

    it("treats occasion as a title alias and coerces numeric static ids", () => {
        const wording = parseTemplateLayoutWording([
            { id: 1, type: "static", text: "Block" },
            { id: "o1", type: "field", field: "occasion", text: "Annual Meeting" },
        ]);

        expect(wording.hasTitle).toBe(true);
        expect(wording.titleText).toBe("Annual Meeting");
        expect(wording.staticTexts).toEqual([{ id: "1", text: "Block", ordinal: 1 }]);
    });

    it("parses stringified JSON layouts", () => {
        const wording = parseTemplateLayoutWording(
            JSON.stringify([
                { id: "d1", type: "field", field: "description", text: "from json string" },
            ]),
        );
        expect(wording.hasDescription).toBe(true);
        expect(wording.description).toBe("from json string");
    });
});

describe("normalizeTemplateLayout", () => {
    it("returns null for invalid payloads", () => {
        expect(normalizeTemplateLayout(undefined)).toBeNull();
        expect(normalizeTemplateLayout("{not-json")).toBeNull();
        expect(normalizeTemplateLayout({ elements: [] })).toBeNull();
    });
});
