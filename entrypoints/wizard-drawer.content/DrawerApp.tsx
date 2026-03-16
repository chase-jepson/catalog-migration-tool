import { WizardShell } from '../../components/wizard/WizardShell';

type WizardType = 'catalog' | 'inventory';

interface DrawerAppProps {
  wizardType: WizardType;
  onClose: () => void;
}

export function DrawerApp({ wizardType, onClose }: DrawerAppProps) {
  return (
    <>
      {/* Backdrop — matches MuiBackdrop rgba(0,0,0,0.5) */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        style={{ zIndex: 1299 }}
        onClick={onClose}
      />
      {/* Drawer panel — matches Treez MuiDrawer-paperAnchorRight */}
      <div
        className="fixed top-0 right-0 bottom-0 flex flex-col overflow-hidden bg-white font-[Roboto,sans-serif]"
        style={{
          zIndex: 1300,
          width: 'min(576px, 90vw)',
          borderRadius: '16px 0 0 16px',
          boxShadow:
            'rgba(0,0,0,0.2) 0px 8px 10px -5px, rgba(0,0,0,0.14) 0px 16px 24px 2px, rgba(0,0,0,0.12) 0px 6px 30px 5px',
          animation: 'slideInRight 0.2s ease-out',
        }}
      >
        <WizardShell wizardType={wizardType} onClose={onClose} />
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
