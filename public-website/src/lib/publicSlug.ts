import { redirect } from "next/navigation";

const NUMERIC_ID_PATTERN = /^\d+$/;

export function isNumericPublicParam(value: string): boolean {
    return NUMERIC_ID_PATTERN.test(value.trim());
}

/**
 * When the URL still uses a numeric id, permanently redirect to the canonical slug path.
 * Preserves trailing path segments and query string.
 */
export function redirectNumericParamToSlug(options: {
    param: string;
    slug: string;
    basePath: "events" | "projects";
    suffix?: string;
    searchParams?: Record<string, string | undefined>;
}): void {
    const { param, slug, basePath, suffix = "", searchParams } = options;
    if (!isNumericPublicParam(param) || !slug || param === slug) {
        return;
    }

    const query = new URLSearchParams();
    if (searchParams) {
        for (const [key, value] of Object.entries(searchParams)) {
            if (value != null && value !== "") {
                query.set(key, value);
            }
        }
    }
    const qs = query.toString();
    const path = `/${basePath}/${slug}${suffix}${qs ? `?${qs}` : ""}`;
    redirect(path);
}

export function publicEventPath(slugOrId: string | number, suffix = ""): string {
    return `/events/${slugOrId}${suffix}`;
}

export function publicProjectPath(slugOrId: string | number): string {
    return `/projects/${slugOrId}`;
}
