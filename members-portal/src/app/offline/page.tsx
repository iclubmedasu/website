'use client'

import styles from './page.module.css'

export default function OfflinePage() {
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.icon} aria-hidden="true">
                    📡
                </div>

                <h1 className={styles.title}>You are offline</h1>

                <p className={styles.description}>
                    No internet connection detected. Please check your
                    connection and try again.
                </p>

                <p className={styles.caption}>
                    Some pages you have visited recently may still be
                    available from cache.
                </p>

                <button
                    type="button"
                    className={styles.retryButton}
                    onClick={() => window.location.reload()}
                >
                    Try again
                </button>
            </div>
        </div>
    )
}
