const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  boxSizing: "border-box",
  WebkitTapHighlightColor: "transparent",
  outline: "0px",
  border: "0px",
  margin: "0px",
  cursor: "pointer",
  userSelect: "none",
  verticalAlign: "middle",
  appearance: "none",
  textDecoration: "none",
  textTransform: "none",
  letterSpacing: "0.02857em",
  minWidth: "64px",
  height: "2.5rem",
  padding: "0.5rem 1.25rem",
  borderRadius: "1rem",
  color: "rgb(15, 23, 9)",
  fontWeight: 500,
  fontSize: "0.938rem",
  lineHeight: "1.5rem",
  fontFamily: "Roboto",
  transition: "0.2s",
  backgroundColor: "rgb(169, 224, 121)",
  whiteSpace: "nowrap",
};

const containerStyle: React.CSSProperties = {
  display: "contents",
};

function handleClick(wizardType: "catalog" | "inventory") {
  // Dispatch custom event for the wizard-drawer content script
  document.dispatchEvent(new CustomEvent("cmt:open-wizard", { detail: { wizardType } }));
}

export default function App() {
  return (
    <div style={containerStyle}>
      <button
        type="button"
        style={buttonStyle}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = "rgb(145, 200, 100)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = "rgb(169, 224, 121)";
        }}
        onClick={() => handleClick("catalog")}
      >
        Migrate Catalog
      </button>
      <button
        type="button"
        style={buttonStyle}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = "rgb(145, 200, 100)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = "rgb(169, 224, 121)";
        }}
        onClick={() => handleClick("inventory")}
      >
        Migrate Inventory
      </button>
    </div>
  );
}
