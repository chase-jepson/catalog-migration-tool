interface StepIndicatorProps {
  steps: string[];
  current: number;
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      {steps.map((label, index) => {
        const isCompleted = index < current;
        const isCurrent = index === current;
        const isFuture = index > current;

        return (
          <div key={label} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  isCompleted
                    ? 'bg-teal-600 text-white'
                    : isCurrent
                      ? 'border-2 border-teal-600 bg-teal-50 text-teal-700'
                      : 'border border-gray-300 bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-1 text-[10px] ${
                  isCurrent
                    ? 'font-semibold text-teal-700'
                    : isFuture
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-8 ${
                  index < current ? 'bg-teal-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
