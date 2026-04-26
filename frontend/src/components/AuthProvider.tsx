import React, { useState, useEffect } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { Loader2, ShieldAlert } from 'lucide-react';

interface AuthConfig {
  auth0Domain: string;
  auth0ClientId: string;
  auth0Audience: string;
  authRequired: boolean;
}

let globalIsAuthEnabled = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/config')
      .then(res => res.json())
      .then((data: AuthConfig) => {
        setConfig(data);
        globalIsAuthEnabled = !!(data.auth0Domain && data.auth0ClientId);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load runtime config:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAuthEnabled = !!(config?.auth0Domain && config?.auth0ClientId);
  const authMismatch = config?.authRequired && !isAuthEnabled;

  if (authMismatch) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-background text-foreground">
        <ShieldAlert className="w-16 h-16 text-destructive mb-6" />
        <h2 className="text-2xl font-bold text-destructive mb-4">Configuration Error</h2>
        <p className="max-w-md mb-6">
          The backend requires authentication, but the frontend is not correctly configured.
          <strong> AUTH0_CLIENT_ID</strong> is missing in your environment variables.
        </p>
        <div className="p-4 bg-secondary rounded-md text-sm text-left font-mono mb-6">
          Domain: {config?.auth0Domain || 'Not set'}<br/>
          Client ID: {config?.auth0ClientId ? 'Set' : 'MISSING'}
        </div>
        <p className="text-sm text-muted-foreground">
          Please add the <code className="bg-muted px-1">AUTH0_CLIENT_ID</code> to your 
          <code className="bg-muted px-1">compose.yml</code> and restart the container.
        </p>
      </div>
    );
  }

  if (!isAuthEnabled) {
    return <>{children}</>;
  }

  // Check for secure context if Auth0 is enabled
  const isSecure = window.isSecureContext || 
                   window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';

  if (!isSecure) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-background text-foreground">
        <h2 className="text-2xl font-bold text-destructive mb-4">Secure Connection Required</h2>
        <p className="max-w-md mb-6">
          Auth0 authentication requires a secure origin (HTTPS or localhost). 
          You are currently accessing this site over an insecure connection.
        </p>
        <div className="p-4 bg-secondary rounded-md text-sm text-left font-mono mb-6">
          Origin: {window.location.origin}
        </div>
        <p className="text-sm text-muted-foreground">
          To fix this, please use <code className="bg-muted px-1">http://localhost</code> or set up HTTPS for your server.
          Alternatively, disable Auth0 by removing the <code className="bg-muted px-1">AUTH0_DOMAIN</code> environment variable.
        </p>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={config!.auth0Domain}
      clientId={config!.auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: config!.auth0Audience || undefined,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      {children}
    </Auth0Provider>
  );
}

// Hook to safely use auth0 even if disabled
export function useAuth() {
  if (!globalIsAuthEnabled) {
    return {
      isLoading: false,
      isAuthenticated: true,
      loginWithRedirect: () => Promise.resolve(),
      logout: () => {},
      getAccessTokenSilently: () => Promise.resolve(''),
      user: null,
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAuth0();
}

export function isAuthEnabled() {
  return globalIsAuthEnabled;
}
