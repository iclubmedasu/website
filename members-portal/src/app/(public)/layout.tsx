export default function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <main style={{ minHeight: '100vh' }}>
            {children}
        </main>
    )
}
