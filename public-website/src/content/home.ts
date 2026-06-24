export const homeContent = {
    hero: {
        primaryCta: { label: "Explore Events", href: "/events" },
        secondaryCta: { label: "Get Involved", href: "/contact" },
    },
    highlights: {
        title: "By the numbers",
        items: [
            // Update these figures with verified club stats when available.
            { value: "10+", label: "Events per year" },
            { value: "5+", label: "Active projects" },
            { value: "100+", label: "Student members" },
            { value: "1", label: "Innovation community" },
        ],
    },
    whyIclub: {
        title: "Why join iClub?",
        description: "A student-led community built for curiosity, collaboration, and real-world impact in medicine.",
        items: [
            {
                title: "Learn by doing",
                text: "Workshops, talks, and hands-on sessions that go beyond the lecture hall.",
            },
            {
                title: "Build together",
                text: "Collaborate on projects that tackle real healthcare challenges with peers across disciplines.",
            },
            {
                title: "Grow your network",
                text: "Meet mentors, partners, and fellow students who share your drive for innovation.",
            },
            {
                title: "Lead with purpose",
                text: "Take ownership of initiatives, develop leadership skills, and shape the club's direction.",
            },
        ],
    },
    aboutPreview: {
        title: "More than a club",
        text: "We are a community of medical students at Ain Shams University who believe healthcare innovation starts with curiosity. From workshops to collaborative projects, we create spaces where ideas become action.",
        linkLabel: "Read our story",
        linkHref: "/about",
    },
    cta: {
        title: "Ready to get involved?",
        text: "Whether you want to attend an event, join a project, or explore a partnership — we'd love to hear from you.",
        primaryCta: { label: "Contact Us", href: "/contact" },
        secondaryCta: { label: "View Events", href: "/events" },
    },
} as const;
