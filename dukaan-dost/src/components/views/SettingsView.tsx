import {
  AlertCircle,
  CheckCircle2,
  Clock,
  DatabaseZap,
  RefreshCw,
  Save,
  Store,
  XCircle,
} from 'lucide-react';
import type {FormEvent} from 'react';
import {useEffect, useState} from 'react';
import {testFirebaseConnection} from '../../lib/api';
import type {FirebaseTestResult, HealthStatus, ShopProfile} from '../../types/shop';
import {formatDateTime} from '../../utils/format';

interface SettingsViewProps {
  profile: ShopProfile;
  healthStatus: HealthStatus;
  healthLoading: boolean;
  healthError: string | null;
  onSaveProfile: (profile: ShopProfile) => Promise<void>;
  onRefreshStatus: () => Promise<void>;
}

export function SettingsView({
  profile,
  healthStatus,
  healthLoading,
  healthError,
  onSaveProfile,
  onRefreshStatus,
}: SettingsViewProps) {
  const [shopName, setShopName] = useState(profile.shopName);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [phone, setPhone] = useState(profile.phone);
  const [cityAddress, setCityAddress] = useState(profile.cityAddress);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [testingFirebase, setTestingFirebase] = useState(false);
  const [firebaseTestResult, setFirebaseTestResult] = useState<FirebaseTestResult | null>(null);
  const [firebaseTestError, setFirebaseTestError] = useState<string | null>(null);

  useEffect(() => {
    setShopName(profile.shopName);
    setOwnerName(profile.ownerName);
    setPhone(profile.phone);
    setCityAddress(profile.cityAddress);
  }, [profile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedNotice(false);
    setSaveError(null);
    try {
      await onSaveProfile({
        shopName: shopName.trim() || 'Dukaan Dost — Apni Dukaan',
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        cityAddress: cityAddress.trim(),
        currency: 'PKR',
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save shop profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestFirebase = async () => {
    setTestingFirebase(true);
    setFirebaseTestResult(null);
    setFirebaseTestError(null);
    try {
      const result = await testFirebaseConnection();
      setFirebaseTestResult(result);
      await onRefreshStatus();
    } catch (err) {
      setFirebaseTestError(
        err instanceof Error ? err.message : 'Live Firestore read/write test failed.',
      );
    } finally {
      setTestingFirebase(false);
    }
  };

  const serverConnected = healthStatus.server === 'connected' && !healthError;

  const connections = [
    {
      name: 'Backend API (Express / Node.js)',
      state: serverConnected ? ('connected' as const) : ('error' as const),
      label: serverConnected ? 'Connected' : 'Unreachable',
      detail: serverConnected
        ? `Responding cleanly (status: ${healthStatus.status})`
        : 'Cannot reach GET /api/health',
    },
    {
      name: 'Firebase Firestore Database',
      state: healthStatus.firebaseConnected ? ('connected' as const) : ('error' as const),
      label: healthStatus.firebaseConnected ? 'Connected' : 'Disconnected',
      detail: healthStatus.firebaseConnected
        ? 'Connected to Cloud Firestore (dukaan-dost-20b43)'
        : 'Unable to reach Cloud Firestore (default) database',
    },
    {
      name: 'Gemini AI Assistant (gemini-3.8-flash)',
      state: healthStatus.geminiConfigured ? ('connected' as const) : ('pending' as const),
      label: healthStatus.geminiConfigured ? 'Connected' : 'Pending Key',
      detail: healthStatus.geminiConfigured
        ? 'Server-side GEMINI_API_KEY active for NLU & Business Advisor'
        : 'Set GEMINI_API_KEY in environment secrets',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <h1 className="text-xl font-bold text-slate-900">Settings / Dukaan Profile</h1>
        <p className="text-sm text-slate-600 mt-1">
          Apni dukaan ki maloomat aur live Firestore / Gemini connections verify karein
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Shop Profile Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
            <Store className="w-5 h-5 text-emerald-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">Shop Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="set-shop-name"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Shop Name (Dukaan ka Naam)
              </label>
              <input
                id="set-shop-name"
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Dukaan Dost — Apni Dukaan"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="set-owner"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Owner Name (Malik ka Naam)
              </label>
              <input
                id="set-owner"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g., Haji Muhammad Akram"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="set-phone"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Phone Number
              </label>
              <input
                id="set-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03XX-XXXXXXX"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="set-city"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                City / Address (Shehar / Pata)
              </label>
              <input
                id="set-city"
                type="text"
                value={cityAddress}
                onChange={(e) => setCityAddress(e.target.value)}
                placeholder="e.g., Model Town, Lahore"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="set-currency"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Currency
              </label>
              <input
                id="set-currency"
                type="text"
                readOnly
                value="PKR / Rs."
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-100 text-slate-700 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {saveError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {saveError}
            </p>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{isSaving ? 'Saving...' : 'Save Shop Profile'}</span>
            </button>
            {savedNotice && (
              <span className="text-sm font-semibold text-emerald-700">
                Shop profile saved to Firestore.
              </span>
            )}
          </div>
        </form>

        {/* System Connection Status */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">System Connection Status</h2>
            <button
              type="button"
              onClick={() => void onRefreshStatus()}
              disabled={healthLoading}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{healthLoading ? 'Checking...' : 'Refresh'}</span>
            </button>
          </div>

          {healthError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" aria-hidden="true" />
              <span>{healthError}</span>
            </div>
          )}

          {healthLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-16 rounded-lg border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => {
                const badgeClass =
                  conn.state === 'connected'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : conn.state === 'error'
                      ? 'bg-red-50 text-red-800 border-red-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200';

                const Icon =
                  conn.state === 'connected'
                    ? CheckCircle2
                    : conn.state === 'error'
                      ? XCircle
                      : Clock;

                return (
                  <div
                    key={conn.name}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{conn.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {conn.detail}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap shrink-0 ${badgeClass}`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {conn.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Test Firebase Connection Button */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <button
              type="button"
              onClick={() => void handleTestFirebase()}
              disabled={testingFirebase}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <DatabaseZap className="w-4 h-4" aria-hidden="true" />
              <span>{testingFirebase ? 'Testing Live Firestore...' : 'Test Firebase Connection'}</span>
            </button>

            {firebaseTestResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                <p className="font-semibold">{firebaseTestResult.message}</p>
                <p className="tabular-nums">
                  Project: {firebaseTestResult.projectId} · Latency: {firebaseTestResult.latencyMs}ms
                </p>
              </div>
            )}

            {firebaseTestError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs space-y-2">
                <p className="font-semibold">{firebaseTestError}</p>
                <p className="text-red-800">
                  In Firebase Console → Firestore Database → Rules for{' '}
                  <code className="font-mono">dukaan-dost-20b43</code>, publish rules allowing
                  Dukaan Dost collections (<code className="font-mono">shops</code>,{' '}
                  <code className="font-mono">products</code>,{' '}
                  <code className="font-mono">customers</code>,{' '}
                  <code className="font-mono">transactions</code>,{' '}
                  <code className="font-mono">payments</code>,{' '}
                  <code className="font-mono">expenses</code>,{' '}
                  <code className="font-mono">stock_movements</code>,{' '}
                  <code className="font-mono">pending_actions</code>), then click Test Firebase
                  Connection again.
                </p>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 pt-1">
            Last checked: {formatDateTime(healthStatus.timestamp)}
          </p>
        </section>
      </div>
    </div>
  );
}
