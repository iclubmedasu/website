/**
 * Seed script: populate the ProjectType table with all standard project types.
 * Run once after migration:
 *   node scripts/seed-project-types.js
 * Safe to re-run – uses upsert so existing records are not duplicated.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PROJECT_TYPES = [
    // ── Events & Activities ──────────────────────────────────────────────────
    { name: 'Conference/Seminar', category: 'Events & Activities', sortOrder: 10, description: 'Organizing conferences, seminars, workshops' },
    { name: 'Workshop', category: 'Events & Activities', sortOrder: 11, description: 'Hands-on training or skill-building sessions' },
    { name: 'Hackathon', category: 'Events & Activities', sortOrder: 12, description: 'Coding competitions or innovation challenges' },
    { name: 'Competition', category: 'Events & Activities', sortOrder: 13, description: 'Any competitive event (sports, academic, etc.)' },
    { name: 'Social Event', category: 'Events & Activities', sortOrder: 14, description: 'Parties, gatherings, team building activities' },
    { name: 'Charity Event', category: 'Events & Activities', sortOrder: 15, description: 'Fundraising, volunteer activities, community service' },
    { name: 'Exhibition', category: 'Events & Activities', sortOrder: 16, description: 'Showcasing work, products, or achievements' },
    { name: 'Webinar', category: 'Events & Activities', sortOrder: 17, description: 'Online seminars or presentations' },
    { name: 'Meetup', category: 'Events & Activities', sortOrder: 18, description: 'Informal gathering or networking event' },
    { name: 'Field Trip', category: 'Events & Activities', sortOrder: 19, description: 'Educational visits or tours' },
    { name: 'Awards Ceremony', category: 'Events & Activities', sortOrder: 20, description: 'Recognition events, graduations, celebrations' },

    // ── Marketing & Communications ───────────────────────────────────────────
    { name: 'Marketing Campaign', category: 'Marketing & Communications', sortOrder: 30, description: 'Promotional activities, advertising' },
    { name: 'Social Media Campaign', category: 'Marketing & Communications', sortOrder: 31, description: 'Instagram, Facebook, LinkedIn, Twitter campaigns' },
    { name: 'Content Creation', category: 'Marketing & Communications', sortOrder: 32, description: 'Blog posts, videos, podcasts, articles' },
    { name: 'Branding', category: 'Marketing & Communications', sortOrder: 33, description: 'Logo design, brand guidelines, visual identity' },
    { name: 'Public Relations', category: 'Marketing & Communications', sortOrder: 34, description: 'Press releases, media outreach' },
    { name: 'Newsletter', category: 'Marketing & Communications', sortOrder: 35, description: 'Regular email or print publications' },
    { name: 'Photography/Videography', category: 'Marketing & Communications', sortOrder: 36, description: 'Photo shoots, video production' },
    { name: 'Graphic Design', category: 'Marketing & Communications', sortOrder: 37, description: 'Posters, flyers, digital assets' },

    // ── Technology & Development ─────────────────────────────────────────────
    { name: 'Software Development', category: 'Technology & Development', sortOrder: 50, description: 'Apps, websites, platforms' },
    { name: 'Website Redesign', category: 'Technology & Development', sortOrder: 51, description: 'Updating existing web presence' },
    { name: 'Mobile App', category: 'Technology & Development', sortOrder: 52, description: 'iOS/Android application development' },
    { name: 'API Development', category: 'Technology & Development', sortOrder: 53, description: 'Backend services, integrations' },
    { name: 'Database Project', category: 'Technology & Development', sortOrder: 54, description: 'Data management, migration, optimization' },
    { name: 'DevOps/Infrastructure', category: 'Technology & Development', sortOrder: 55, description: 'Server setup, deployment pipelines' },
    { name: 'AI/ML Project', category: 'Technology & Development', sortOrder: 56, description: 'Machine learning, data science initiatives' },
    { name: 'Automation', category: 'Technology & Development', sortOrder: 57, description: 'Process automation, bot development' },
    { name: 'Security Audit', category: 'Technology & Development', sortOrder: 58, description: 'Cybersecurity assessment, penetration testing' },

    // ── Research & Academic ───────────────────────────────────────────────────
    { name: 'Research Study', category: 'Research & Academic', sortOrder: 70, description: 'Academic research, experiments' },
    { name: 'Survey/Data Collection', category: 'Research & Academic', sortOrder: 71, description: 'Gathering information, questionnaires' },
    { name: 'Case Study', category: 'Research & Academic', sortOrder: 72, description: 'In-depth analysis of specific scenarios' },
    { name: 'Literature Review', category: 'Research & Academic', sortOrder: 73, description: 'Reviewing existing research' },
    { name: 'Publication', category: 'Research & Academic', sortOrder: 74, description: 'Writing papers, journals, books' },
    { name: 'Thesis/Dissertation', category: 'Research & Academic', sortOrder: 75, description: 'Graduate-level research projects' },
    { name: 'Lab Experiment', category: 'Research & Academic', sortOrder: 76, description: 'Scientific laboratory work' },

    // ── Business & Operations ─────────────────────────────────────────────────
    { name: 'Business Plan', category: 'Business & Operations', sortOrder: 90, description: 'Strategic planning, business proposals' },
    { name: 'Fundraising', category: 'Business & Operations', sortOrder: 91, description: 'Seeking financial support, grants' },
    { name: 'Sponsorship', category: 'Business & Operations', sortOrder: 92, description: 'Securing sponsors, partnerships' },
    { name: 'Budget Planning', category: 'Business & Operations', sortOrder: 93, description: 'Financial planning and allocation' },
    { name: 'Strategic Planning', category: 'Business & Operations', sortOrder: 94, description: 'Long-term organizational strategy' },
    { name: 'Recruitment', category: 'Business & Operations', sortOrder: 95, description: 'Hiring, onboarding new members' },
    { name: 'Training Program', category: 'Business & Operations', sortOrder: 96, description: 'Staff/member training initiatives' },
    { name: 'Process Improvement', category: 'Business & Operations', sortOrder: 97, description: 'Optimizing workflows, efficiency' },
    { name: 'Audit/Compliance', category: 'Business & Operations', sortOrder: 98, description: 'Regulatory compliance, internal audits' },

    // ── Creative & Design ─────────────────────────────────────────────────────
    { name: 'Design Project', category: 'Creative & Design', sortOrder: 110, description: 'UI/UX, graphic design, visual design' },
    { name: 'Video Production', category: 'Creative & Design', sortOrder: 111, description: 'Film, documentary, promotional video' },
    { name: 'Music/Audio', category: 'Creative & Design', sortOrder: 112, description: 'Podcast, music production, sound design' },
    { name: 'Writing Project', category: 'Creative & Design', sortOrder: 113, description: 'Books, scripts, creative writing' },
    { name: 'Art Installation', category: 'Creative & Design', sortOrder: 114, description: 'Physical or digital art projects' },
    { name: 'Animation', category: 'Creative & Design', sortOrder: 115, description: 'Motion graphics, 2D/3D animation' },

    // ── Collaboration & Partnerships ──────────────────────────────────────────
    { name: 'Partnership', category: 'Collaboration & Partnerships', sortOrder: 130, description: 'Collaborating with external organizations' },
    { name: 'Joint Venture', category: 'Collaboration & Partnerships', sortOrder: 131, description: 'Multi-organization projects' },
    { name: 'Cross-Team Initiative', category: 'Collaboration & Partnerships', sortOrder: 132, description: 'Multiple internal teams working together' },
    { name: 'Community Outreach', category: 'Collaboration & Partnerships', sortOrder: 133, description: 'Engaging with external communities' },
    { name: 'Alumni Relations', category: 'Collaboration & Partnerships', sortOrder: 134, description: 'Connecting with former members' },

    // ── Internal Operations ───────────────────────────────────────────────────
    { name: 'System Upgrade', category: 'Internal Operations', sortOrder: 150, description: 'Updating tools, software, processes' },
    { name: 'Documentation', category: 'Internal Operations', sortOrder: 151, description: 'Creating guides, manuals, wikis' },
    { name: 'Onboarding', category: 'Internal Operations', sortOrder: 152, description: 'New member orientation programs' },
    { name: 'Performance Review', category: 'Internal Operations', sortOrder: 153, description: 'Evaluation and feedback cycles' },
    { name: 'Policy Development', category: 'Internal Operations', sortOrder: 154, description: 'Creating rules, guidelines, procedures' },
    { name: 'Inventory Management', category: 'Internal Operations', sortOrder: 155, description: 'Tracking assets, equipment' },
    { name: 'Facilities Management', category: 'Internal Operations', sortOrder: 156, description: 'Office/space management' },

    // ── Product & Innovation ──────────────────────────────────────────────────
    { name: 'Product Launch', category: 'Product & Innovation', sortOrder: 170, description: 'Introducing new products/services' },
    { name: 'Product Development', category: 'Product & Innovation', sortOrder: 171, description: 'Building new offerings' },
    { name: 'Beta Testing', category: 'Product & Innovation', sortOrder: 172, description: 'Testing products before launch' },
    { name: 'Feature Development', category: 'Product & Innovation', sortOrder: 173, description: 'Adding capabilities to existing products' },
    { name: 'Innovation Initiative', category: 'Product & Innovation', sortOrder: 174, description: 'Exploring new ideas, R&D' },
    { name: 'Prototype', category: 'Product & Innovation', sortOrder: 175, description: 'Building proof-of-concept versions' },

    // ── Maintenance & Support ─────────────────────────────────────────────────
    { name: 'Maintenance', category: 'Maintenance & Support', sortOrder: 190, description: 'Ongoing upkeep of systems/facilities' },
    { name: 'Bug Fix', category: 'Maintenance & Support', sortOrder: 191, description: 'Resolving technical issues' },
    { name: 'Customer Support', category: 'Maintenance & Support', sortOrder: 192, description: 'Helping users/members' },
    { name: 'Technical Support', category: 'Maintenance & Support', sortOrder: 193, description: 'IT help desk activities' },
    { name: 'System Migration', category: 'Maintenance & Support', sortOrder: 194, description: 'Moving to new platforms/tools' },

    // ── Miscellaneous ─────────────────────────────────────────────────────────
    { name: 'Other', category: 'Miscellaneous', sortOrder: 210, description: 'Catch-all for unique projects' },
    { name: 'General Task', category: 'Miscellaneous', sortOrder: 211, description: 'Simple, uncategorized work' },
    { name: 'Administrative', category: 'Miscellaneous', sortOrder: 212, description: 'General admin work' },
    { name: 'Personal Development', category: 'Miscellaneous', sortOrder: 213, description: 'Self-improvement initiatives' },
    { name: 'Pilot Program', category: 'Miscellaneous', sortOrder: 214, description: 'Testing new concepts before full rollout' },
];

async function seed() {
    console.log(`Seeding ${PROJECT_TYPES.length} project types...`);
    let created = 0;
    let skipped = 0;

    for (const pt of PROJECT_TYPES) {
        const result = await prisma.projectType.upsert({
            where: { name: pt.name },
            update: {},          // don't overwrite if it already exists
            create: {
                name: pt.name,
                category: pt.category,
                description: pt.description ?? null,
                sortOrder: pt.sortOrder,
                isActive: true,
            },
        });

        if (result.id) {
            // distinguish created vs existing by checking createdAt ≈ now
            const age = Date.now() - new Date(result.createdAt).getTime();
            if (age < 5000) {
                created++;
                console.log(`  ✓ Created: ${pt.name}`);
            } else {
                skipped++;
                console.log(`  – Skipped (already exists): ${pt.name}`);
            }
        }
    }

    console.log(`\nDone. Created: ${created}, Already existed: ${skipped}`);
}

seed()
    .catch((err) => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
