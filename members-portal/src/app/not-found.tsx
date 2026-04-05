import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="members-page not-found-page">
            <h1>Page Not Found</h1>
            <p>The page you are looking for does not exist or may have been moved.</p>
            <p>
                <Link href="/dashboard">Go to Dashboard</Link>
                {' | '}
                <Link href="/login">Go to Login</Link>
            </p>
        </main>
    );
}
