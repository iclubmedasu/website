export function DataLoadingState({ label = "Loading…" }: { label?: string }) {
    return (
        <div className="empty-state">
            <p className="empty-state-text">{label}</p>
        </div>
    );
}
