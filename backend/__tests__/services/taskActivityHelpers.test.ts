import { describe, expect, it } from 'vitest';
import {
    buildDependencyAddedDescription,
    buildDependencyAddedValue,
    buildTaskAssignedActivityValue,
    buildTaskAssignedDescription,
    buildTaskSelfAssignedDescription,
    buildTaskUnassignedDescription,
    getTaskMemberName,
} from '../../services/taskActivityHelpers';

describe('taskActivityHelpers', () => {
    const member = { fullName: 'Jane Doe' };

    it('resolves member name with fallback', () => {
        expect(getTaskMemberName(7, member)).toBe('Jane Doe');
        expect(getTaskMemberName(7, null)).toBe('Member #7');
    });

    it('builds assigned activity value and description', () => {
        expect(buildTaskAssignedActivityValue({
            memberId: 7,
            member,
            taskTitle: 'Wireframes',
        })).toEqual({
            memberId: 7,
            memberName: 'Jane Doe',
            taskTitle: 'Wireframes',
        });

        expect(buildTaskAssignedDescription('Wireframes', 7, member)).toBe('Assigned Jane Doe to "Wireframes"');
    });

    it('builds self-assigned and unassigned descriptions', () => {
        expect(buildTaskSelfAssignedDescription('Wireframes', 7, member)).toBe('Jane Doe self-assigned to "Wireframes"');
        expect(buildTaskUnassignedDescription('Wireframes', 7, member)).toBe('Unassigned Jane Doe from "Wireframes"');
    });

    it('builds dependency payloads with task titles', () => {
        expect(buildDependencyAddedValue(12, 'Design review', 'FINISH_TO_START')).toEqual({
            dependsOnTaskId: 12,
            dependsOnTaskTitle: 'Design review',
            dependencyType: 'FINISH_TO_START',
        });
        expect(buildDependencyAddedDescription('Design review')).toBe('Dependency added on "Design review"');
    });
});
