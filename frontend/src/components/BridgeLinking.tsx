import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import type { Connection } from '@/lib/types';

export type LinkingStatus = 'handshaking' | 'linking' | 'success' | 'error' | null;

export function useBridgeHandshake(
  tokenInitialized: boolean,
  isAuthenticated: boolean,
  setSelectedConn: (conn: Connection) => void
) {
  const [status, setStatus] = useState<LinkingStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const triggered = useRef(false);

  useEffect(() => {
    if (!tokenInitialized || !isAuthenticated || triggered.current) return;

    const params = new URLSearchParams(window.location.search);
    const bridgeUrl = params.get('bridge');

    if (bridgeUrl) {
      triggered.current = true;
      console.log("🔗 [Handshake] Bridge link detected:", bridgeUrl);
      setStatus('handshaking');
      
      const safetyTimeout = setTimeout(() => {
        // Only trigger if we are still in a loading state
        setStatus(prev => {
          if (prev === 'handshaking' || prev === 'linking') {
            console.warn("⚠️ [Handshake] Timed out after 10s");
            setError("Handshake timed out. Check if Bridge Agent is running and accessible.");
            return 'error';
          }
          return prev;
        });
      }, 10000);

      const timer = setTimeout(() => {
        console.log("📡 [Handshake] Step 1: Fetching share details...");
        fetch(`${bridgeUrl}/api/last-share`)
          .then(res => {
            if (!res.ok) throw new Error("Bridge Agent is not responding. (Status: " + res.status + ")");
            return res.json();
          })
          .then(details => {
            console.log("✅ [Handshake] Step 1 Success:", details);
            setStatus('linking');
            const alias = `Bridge: ${details.name}`;
            
            console.log("📡 [Handshake] Step 2: Posting to backend...");
            return api.post('/api/v1/connections', {
              alias: alias,
              host: details.ip,
              port: 445,
              shareName: details.name,
              username: details.user,
              password: details.pass
            }).then(res => ({ res, details, alias }));
          })
          .then(({ res, details: _details, alias }) => {
            console.log("✅ [Handshake] Step 2 Success!");
            qc.invalidateQueries({ queryKey: ['connections'] });
            
            const conn = res.data;
            if (conn && conn.alias) {
              setSelectedConn(conn);
            } else {
              api.get<Connection[]>('/api/v1/connections').then(response => {
                const existing = response.data.find(c => c.alias === alias);
                if (existing) setSelectedConn(existing);
              });
            }

            window.history.replaceState({}, document.title, "/");
            fetch(`${bridgeUrl}/api/success`, { method: 'POST' }).catch(() => { });
            setStatus('success');
            clearTimeout(safetyTimeout);
            setTimeout(() => setStatus(null), 2000);
          })
          .catch(err => {
            clearTimeout(safetyTimeout);
            
            // Handle 409 specifically
            if (err.response?.status === 409) {
              console.log("ℹ️ [Handshake] Connection exists (409).");
              const alias = `Bridge: ${err.config.data ? JSON.parse(err.config.data).alias : ''}`;
              api.get<Connection[]>('/api/v1/connections').then(response => {
                const existing = response.data.find(c => c.alias === alias);
                if (existing) setSelectedConn(existing);
              });
              window.history.replaceState({}, document.title, "/");
              fetch(`${bridgeUrl}/api/success`, { method: 'POST' }).catch(() => { });
              setStatus('success');
              setTimeout(() => setStatus(null), 2000);
              return;
            }

            console.error("❌ [Handshake] Failed:", err);
            setError(err.message || "Connection failed");
            setStatus('error');
          });
      }, 800);

      return () => {
        clearTimeout(timer);
        clearTimeout(safetyTimeout);
      };
    }
  }, [tokenInitialized, isAuthenticated, qc, setSelectedConn]);

  return { status, error, reset: () => { setStatus(null); setError(null); } };
}

export function BridgeLinkingOverlay({ status, error, onReset }: { status: LinkingStatus, error: string | null, onReset: () => void }) {
  if (!status) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
      <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl shadow-2xl text-center space-y-6 max-w-sm w-full mx-4 animate-in zoom-in duration-300">
        {status === 'success' ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border-4 border-green-500/50">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Bridge Active!</h2>
            <p className="text-slate-400 text-sm">NAS successfully linked to your workspace.</p>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border-4 border-red-500/50">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Handshake Failed</h2>
            <p className="text-red-400/80 text-xs font-medium max-w-[240px] mx-auto leading-relaxed">{error}</p>
            <button
              onClick={onReset}
              className="mt-4 px-8 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all font-bold border border-slate-700 shadow-lg active:scale-95"
            >
              Cancel & Manual Setup
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-8">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-primary">
                <RefreshCw className="w-8 h-8" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {status === 'handshaking' ? 'Handshaking...' : 'Linking NAS...'}
              </h2>
              <p className="text-slate-400 text-xs animate-pulse font-medium">
                Establishing secure bridge to legacy share
              </p>
            </div>
            <button 
              onClick={onReset}
              className="text-[10px] text-slate-600 hover:text-slate-400 uppercase tracking-widest font-bold transition-colors"
            >
              Skip Setup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
