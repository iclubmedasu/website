import { isConflictError } from '@/services/api';
import type { EventRegistrationRef } from '@/types/backend-contracts';

export function handleRegistrationConflict(
    error: unknown,
    onUpdated: (updated: EventRegistrationRef) => void,
    setError: (message: string) => void,
    fallbackMessage = 'Failed to save.',
): boolean {
    if (isConflictError(error) && error.code === 'VERSION_CONFLICT' && error.latest) {
        onUpdated(error.latest as EventRegistrationRef);
        setError('Updated by someone else. Review the latest values and re-apply your change if needed.');
        return true;
    }

    setError(error instanceof Error ? error.message : fallbackMessage);
    return false;
}
