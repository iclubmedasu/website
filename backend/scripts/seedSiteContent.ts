/**
 * Seed About + Contact CMS rows into the database pointed at by DATABASE_URL.
 *
 * Production (Supabase):
 *   cd backend
 *   # Ensure .env DATABASE_URL is the production connection string, then:
 *   npm run seed:site-content
 *
 * Safe to re-run: if SitePage "about" already exists, Contact is still ensured
 * and About sections/methods are left alone when already present.
 */
import { prisma } from "../db";
import { seedSiteContentDefaults } from "../lib/siteContentSeed";

async function seedSiteContent() {
    const result = await seedSiteContentDefaults();
    if (result === "skipped") {
        console.log("Site content already seeded (About exists) — ensured Contact defaults if needed.");
        return;
    }
    console.log("Site content seeded successfully (About + Contact pages and defaults).");
}

seedSiteContent()
    .catch((error) => {
        console.error("Failed to seed site content:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
