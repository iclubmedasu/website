import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.badge}>PUBLIC WEBSITE PLACEHOLDER</div>
        <div className={styles.intro}>
          <h1>iClub Public Experience</h1>
          <p>
            This Next.js app is now scaffolded and deployable. Content pages, branding, and CMS/data integration will
            be added in a dedicated public-site phase.
          </p>
        </div>
        <div className={styles.ctas}>
          <span className={styles.primary}>Status: Ready for Content Migration</span>
          <span className={styles.secondary}>Tech: Next.js + TypeScript</span>
        </div>
      </main>
    </div>
  );
}
