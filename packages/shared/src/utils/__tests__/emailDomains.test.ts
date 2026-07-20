import { describe, expect, it } from "vitest";
import { COMMON_EMAIL_DOMAINS, matchEmailDomainSuggestions } from "../emailDomains";

describe("emailDomains", () => {
    it("returns prefix matches ranked for partial domain input", () => {
        expect(matchEmailDomainSuggestions("g")).toEqual(
            COMMON_EMAIL_DOMAINS.filter((domain) => domain.startsWith("g")),
        );
        expect(matchEmailDomainSuggestions("@g")).toEqual(
            COMMON_EMAIL_DOMAINS.filter((domain) => domain.startsWith("g")),
        );
        expect(matchEmailDomainSuggestions("gmail")).toEqual(["gmail.com"]);
    });

    it("returns no suggestions for non-matching partial domains", () => {
        expect(matchEmailDomainSuggestions("custom.org")).toEqual([]);
        expect(matchEmailDomainSuggestions("zzz")).toEqual([]);
    });

    it("returns all common domains when partial is empty", () => {
        expect(matchEmailDomainSuggestions("")).toEqual([...COMMON_EMAIL_DOMAINS]);
        expect(matchEmailDomainSuggestions("@")).toEqual([...COMMON_EMAIL_DOMAINS]);
    });
});
