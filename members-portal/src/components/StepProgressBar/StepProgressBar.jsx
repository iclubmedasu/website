import { Check } from 'lucide-react';
import './StepProgressBar.css';

/**
 * Reusable step progress bar component.
 *
 * @param {Object}   props
 * @param {string[]} props.steps       - Array of step labels.
 * @param {number}   props.currentStep - Zero-based index of the active step.
 */
function StepProgressBar({ steps, currentStep }) {
    return (
        <div className="step-progress-bar" role="navigation" aria-label="Sign-up progress">
            {steps.map((label, idx) => {
                const isCompleted = idx < currentStep;
                const isActive = idx === currentStep;

                return (
                    <div key={label} style={{ display: 'contents' }}>
                        <div className="step-progress-item">
                            <div
                                className={`step-progress-dot${isCompleted ? ' completed' : ''}${isActive ? ' active' : ''}`}
                                aria-current={isActive ? 'step' : undefined}
                            >
                                {isCompleted ? <Check size={14} strokeWidth={3} /> : idx + 1}
                            </div>
                            <span
                                className={`step-progress-label${isCompleted ? ' completed' : ''}${isActive ? ' active' : ''}`}
                            >
                                {label}
                            </span>
                        </div>

                        {idx < steps.length - 1 && (
                            <div className={`step-progress-line${idx < currentStep ? ' filled' : ''}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default StepProgressBar;
