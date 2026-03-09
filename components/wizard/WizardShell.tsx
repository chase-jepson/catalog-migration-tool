import { useState } from 'react';
import { STEP_LABELS } from '../../lib/constants';
import { StepIndicator } from './StepIndicator';
import { StepPlaceholder } from './StepPlaceholder';

interface WizardShellProps {
  wizardType: 'catalog' | 'inventory';
}

export function WizardShell({ wizardType }: WizardShellProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const title = wizardType === 'catalog' ? 'Migrate Catalog' : 'Migrate Inventory';
  const lastStep = STEP_LABELS.length - 1;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <h1 className="px-4 pt-4 text-lg font-semibold text-gray-900">
          {title}
        </h1>
        <StepIndicator steps={[...STEP_LABELS]} current={currentStep} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-auto bg-gray-50">
        <StepPlaceholder stepName={STEP_LABELS[currentStep]} />
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          disabled={currentStep === 0}
          onClick={() => setCurrentStep((s) => s - 1)}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          disabled={currentStep === lastStep}
          onClick={() => setCurrentStep((s) => s + 1)}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
