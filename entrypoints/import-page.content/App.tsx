import { sendMessage } from '../../lib/messaging';

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#0891b2',
  color: '#ffffff',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: '1.5',
  transition: 'background-color 0.15s ease',
};

const containerStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: '8px',
  alignItems: 'center',
  marginLeft: '8px',
};

function handleClick(wizardType: 'catalog' | 'inventory') {
  // Content script doesn't know its own tabId -- the background script
  // resolves it from sender.tab.id. We pass tabId: 0 as a placeholder;
  // the background onMessage handler uses message.sender.tab.id instead.
  sendMessage('openSidePanel', { tabId: 0, wizardType });
}

export default function App() {
  return (
    <div style={containerStyle}>
      <button
        type="button"
        style={buttonStyle}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = '#0e7490';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = '#0891b2';
        }}
        onClick={() => handleClick('catalog')}
      >
        Migrate Catalog
      </button>
      <button
        type="button"
        style={buttonStyle}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = '#0e7490';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = '#0891b2';
        }}
        onClick={() => handleClick('inventory')}
      >
        Migrate Inventory
      </button>
    </div>
  );
}
