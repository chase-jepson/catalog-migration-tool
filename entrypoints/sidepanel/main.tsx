import ReactDOM from 'react-dom/client';
import './style.css';

function App() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">Catalog Migration Tool</h1>
      <p className="text-sm text-gray-500 mt-2">Side panel shell ready.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
