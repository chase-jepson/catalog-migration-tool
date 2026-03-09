interface StepPlaceholderProps {
  stepName: string;
}

export function StepPlaceholder({ stepName }: StepPlaceholderProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-12 py-16 text-center">
        <p className="text-lg font-medium text-gray-600">Step: {stepName}</p>
        <p className="mt-2 text-sm text-gray-400">Coming in Phase 2</p>
      </div>
    </div>
  );
}
