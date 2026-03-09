import { useEffect, useState } from 'react';
import { WizardShell } from '../../components/wizard/WizardShell';

type WizardType = 'catalog' | 'inventory';

export function App() {
  const [wizardType, setWizardType] = useState<WizardType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read wizard type from session storage on mount
    chrome.storage.session.get('wizardType').then((result) => {
      if (result.wizardType) {
        setWizardType(result.wizardType as WizardType);
      }
      setLoading(false);
    });

    // Listen for changes (user clicks different button while panel is open)
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'session' && changes.wizardType?.newValue) {
        setWizardType(changes.wizardType.newValue as WizardType);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!wizardType) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-gray-500">
          Click "Migrate Catalog" or "Migrate Inventory" on the import page to
          start.
        </p>
      </div>
    );
  }

  return <WizardShell wizardType={wizardType} />;
}
