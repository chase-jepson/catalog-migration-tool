import { useCallback, useState } from "react";
import { sendMessage } from "../../lib/messaging";
import type { PortalSessionInfo } from "../../lib/types";

interface PortalLoginFormProps {
  onAuthenticated: (auth: PortalSessionInfo) => void;
}

export function PortalLoginForm({ onAuthenticated }: PortalLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !password) return;

      setLoading(true);
      setError("");

      try {
        const auth = await sendMessage("portalLogin", {
          username: email,
          password,
        });
        onAuthenticated(auth);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
      } finally {
        setLoading(false);
      }
    },
    [email, password, onAuthenticated],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div>
        <p className="text-sm font-medium text-gray-900">IMS Login</p>
        <p className="text-xs text-gray-500">
          Sign in to run server-side validation (PMS product resolution, TraceTreez lookup)
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="treez-input"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          className="treez-input"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="btn-treez -primary w-full"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0f1709] border-t-transparent" />
            Signing in...
          </span>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
