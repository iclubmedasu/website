import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";

export function ServiceUnavailableMessage({
    backHref = "/",
    backLabel = "Back to Home",
}: {
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <PageContainer className="space-y-6 py-10 sm:py-14">
            <BackLink href={backHref} label={backLabel} />
            <div className="empty-state max-w-lg">
                <h1 className="empty-state-title">Service temporarily unavailable</h1>
                <p className="empty-state-text">
                    We could not load this page right now. The API may still be waking up — please wait a moment and refresh.
                </p>
            </div>
        </PageContainer>
    );
}
