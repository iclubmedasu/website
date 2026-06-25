import type { PublicSupportNoticeBlock } from "@iclub/shared";

interface SupportNoticesProps {
    notices: PublicSupportNoticeBlock[];
}

function NoticeSection({ notice }: { notice: PublicSupportNoticeBlock }) {
    const isArabic = notice.locale === "AR";

    return (
        <div
            className="rounded-2xl border border-purple-100 bg-purple-50/40 p-6 text-slate-700"
            dir={isArabic ? "rtl" : undefined}
            lang={isArabic ? "ar" : "en"}
        >
            <p className="whitespace-pre-line text-sm leading-7 sm:text-base">{notice.content}</p>
        </div>
    );
}

export function SupportNotices({ notices }: SupportNoticesProps) {
    if (!notices.length) return null;

    const englishNotices = notices.filter((notice) => notice.locale === "EN");
    const arabicNotices = notices.filter((notice) => notice.locale === "AR");

    return (
        <div className="space-y-4">
            {englishNotices.map((notice) => (
                <NoticeSection key={notice.id} notice={notice} />
            ))}
            {englishNotices.length > 0 && arabicNotices.length > 0 ? <hr className="border-purple-100" /> : null}
            {arabicNotices.map((notice) => (
                <NoticeSection key={notice.id} notice={notice} />
            ))}
        </div>
    );
}
