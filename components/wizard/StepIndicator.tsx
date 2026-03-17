interface StepIndicatorProps {
  steps: string[];
  current: number;
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div
      className="flex items-center gap-2"
      style={{
        backgroundColor: "#f5f5f5",
        padding: "12px 24px",
        borderBottom: "1px solid #e0e0e0",
      }}
    >
      {steps.map((label, index) => {
        const isCurrent = index === current;

        return (
          <button
            key={label}
            type="button"
            disabled
            className="flex-1 text-center font-[Roboto,sans-serif] text-sm font-medium transition-colors"
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: isCurrent ? "1px solid #a9e079" : "1px solid #e0e0e0",
              backgroundColor: isCurrent ? "#a9e079" : "transparent",
              color: isCurrent ? "#0f1709" : "#666",
              cursor: "default",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
