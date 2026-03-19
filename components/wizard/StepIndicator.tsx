interface StepIndicatorProps {
  steps: string[];
  current: number;
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div
      style={{
        backgroundColor: "#f5f5f5",
        padding: "16px 24px",
        borderBottom: "1px solid #e0e0e0",
      }}
    >
      {/* Grid: equal columns for each step, connectors stretch between */}
      <div
        className="grid items-start"
        style={{
          gridTemplateColumns: steps
            .map((_, i) => (i < steps.length - 1 ? "auto 1fr" : "auto"))
            .join(" "),
        }}
      >
        {steps.map((label, index) => {
          const isCompleted = index < current;
          const isCurrent = index === current;

          return (
            <div key={label} className="contents">
              {/* Step circle + label */}
              <div className="flex flex-col items-center" style={{ minWidth: 48 }}>
                <div
                  className="flex items-center justify-center rounded-full transition-all duration-200"
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: isCompleted
                      ? "#a9e079"
                      : isCurrent
                        ? "#1a4007"
                        : "#f5f5f5",
                    border: isCompleted || isCurrent ? "none" : "2px solid #d1d5db",
                  }}
                >
                  {isCompleted ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1a4007"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span
                      className="font-[Roboto,sans-serif] text-xs font-medium"
                      style={{ color: isCurrent ? "#fff" : "#9ca3af" }}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>
                <span
                  className="mt-1.5 font-[Roboto,sans-serif] text-center leading-tight transition-colors duration-200"
                  style={{
                    fontSize: 11,
                    fontWeight: isCurrent || isCompleted ? 500 : 400,
                    color: isCurrent ? "#0f1709" : isCompleted ? "#1a4007" : "#9ca3af",
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Connector line between steps */}
              {index < steps.length - 1 && (
                <div className="flex items-center" style={{ height: 28, padding: "0 4px", flex: 1 }}>
                  <div
                    className="h-0.5 w-full transition-colors duration-300"
                    style={{ backgroundColor: isCompleted ? "#a9e079" : "#d1d5db" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
