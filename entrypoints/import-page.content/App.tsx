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
  // Use raw chrome.runtime.sendMessage to preserve user gesture context.
  // @webext-core/messaging adds async layers that break the gesture chain,
  // which chrome.sidePanel.open() requires.
  chrome.runtime.sendMessage({
    type: 'openSidePanel',
    data: { wizardType },
  });
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
