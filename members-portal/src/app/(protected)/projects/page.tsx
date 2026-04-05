import type { Metadata } from 'next'
import ProjectsPage from '@/features/Projects/ProjectsPage'

export const metadata: Metadata = {
    title: 'Projects | iClub Members Portal',
    description: 'Track and manage active projects.',
}

export default function ProjectsRoute() {
    return <ProjectsPage />
}
