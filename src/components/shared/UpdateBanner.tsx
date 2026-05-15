import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const VERSION_URL = 'https://festivaldanzarte.com/app-portal/version.json';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.festivaldanzarte.portal';
const DESKTOP_DOWNLOAD_URL = 'https://festivaldanzarte.com/app-portal/desktop/';

declare global {
  interface Window {
    __MOBILE_VERSION__?: string;
    __DESKTOP_VERSION__?: string;
  }
}

interface VersionInfo {
  version: string;
  minVersion?: string;
  message?: string;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function UpdateBanner() {
  const [show, setShow] = useState(false);
  const [info, setInfo] = useState<VersionInfo | null>(null);

  const platform: 'mobile' | 'desktop' | null =
    typeof window !== 'undefined'
      ? window.__MOBILE_VERSION__
        ? 'mobile'
        : window.__DESKTOP_VERSION__
          ? 'desktop'
          : null
      : null;

  useEffect(() => {
    if (!platform) return;
    const current =
      platform === 'mobile' ? window.__MOBILE_VERSION__ : window.__DESKTOP_VERSION__;
    if (!current) return;

    fetch(VERSION_URL, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: VersionInfo | null) => {
        if (!data?.version) return;
        if (compareVersions(data.version, current) > 0) {
          setInfo(data);
          setShow(true);
        }
      })
      .catch(() => {});
  }, [platform]);

  if (!show || !info || !platform) return null;

  const downloadUrl = platform === 'mobile' ? PLAY_STORE_URL : DESKTOP_DOWNLOAD_URL;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[300] flex items-center gap-3 border-t border-cyan/40 bg-glass-bg px-4 py-3 backdrop-blur-md"
      style={{ background: 'rgba(8, 5, 30, 0.95)' }}
    >
      <Download className="h-5 w-5 shrink-0 text-cyan" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-text-white">
          Nueva versión disponible
        </div>
        <div className="text-[11px] text-text-65">
          {info.message || `Versión ${info.version} lista para descargar.`}
        </div>
      </div>
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-cyan px-3 py-1.5 text-[11px] font-semibold uppercase text-[#04020F] transition hover:bg-[#66F0FF]"
        style={{ letterSpacing: '0.5px' }}
      >
        Actualizar
      </a>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Cerrar"
        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-text-45 transition hover:bg-white/5 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
