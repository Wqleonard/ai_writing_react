import { useEffect, useMemo, useState } from 'react';

type Platform = 'mac' | 'win' | 'other';
type Arch = 'arm64' | 'x64' | 'unknown';

type ParsedYml = {
  version: string;
  files: string[];
  path?: string;
};

type DownloadLinks = {
  winX64?: string;
  winArm64?: string;
  macX64?: string;   // prefer dmg, fallback zip
  macArm64?: string; // prefer dmg, fallback zip
};

type AutoChoice = {
  platform: Platform;
  arch: Arch;
  url?: string;
  label: string;
};

type UseLatestDownloadsResult = {
  loading: boolean;
  error: string;
  links: DownloadLinks;
  versionWin?: string;
  versionMac?: string;
  auto: AutoChoice;
  refresh: () => Promise<void>;
};

const DEFAULT_BASE = 'https://story-claw.tos-cn-beijing.volces.com/latest';

function detectPlatform(ua: string): Platform {
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/Windows|Win32|Win64/i.test(ua)) return 'win';
  return 'other';
}

function detectArch(ua: string): Arch {
  if (/arm64|aarch64|apple silicon|arm/i.test(ua)) return 'arm64';
  if (/x86_64|win64|x64|amd64|intel/i.test(ua)) return 'x64';
  return 'unknown';
}

function parseSimpleYml(text: string): ParsedYml {
  const lines = text.split(/\r?\n/);
  let version = '';
  let path: string | undefined;
  const files: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const v = line.match(/^version:\s*(.+)$/);
    if (v) {
      version = v[1].replace(/^['"]|['"]$/g, '');
      continue;
    }

    const p = line.match(/^path:\s*(.+)$/);
    if (p) {
      path = p[1].replace(/^['"]|['"]$/g, '');
      continue;
    }

    const u = line.match(/^-?\s*url:\s*(.+)$/) || line.match(/^-\s+url:\s*(.+)$/);
    if (u) {
      files.push(u[1].replace(/^['"]|['"]$/g, ''));
    }
  }

  return { version, files, path };
}

function pickFile(files: string[], include: RegExp, preferExt?: RegExp): string | undefined {
  const matched = files.filter((f) => include.test(f));
  if (!matched.length) return undefined;
  if (!preferExt) return matched[0];
  return matched.find((f) => preferExt.test(f)) ?? matched[0];
}

function toAbs(base: string, file: string): string {
  return `${base}/${file}`;
}

async function fetchYml(url: string): Promise<ParsedYml> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
  return parseSimpleYml(await res.text());
}

function pickAuto(links: DownloadLinks): AutoChoice {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = detectPlatform(ua);
  const arch = detectArch(ua);

  if (platform === 'mac') {
    if (arch === 'arm64') return { platform, arch, url: links.macArm64, label: 'Download for macOS (Apple Silicon)' };
    return { platform, arch, url: links.macX64, label: 'Download for macOS (Intel)' };
  }

  if (platform === 'win') {
    if (arch === 'arm64') return { platform, arch, url: links.winArm64, label: 'Download for Windows (ARM64)' };
    return { platform, arch, url: links.winX64, label: 'Download for Windows (x64)' };
  }

  return {
    platform,
    arch,
    url: links.winX64 || links.macArm64 || links.macX64,
    label: 'Download latest version',
  };
}

export function useLatestDownloads(base = DEFAULT_BASE): UseLatestDownloadsResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [versionWin, setVersionWin] = useState<string>();
  const [versionMac, setVersionMac] = useState<string>();
  const [links, setLinks] = useState<DownloadLinks>({});

  const refresh = async () => {
    setLoading(true);
    setError('');

    try {
      const [winYml, macYml] = await Promise.all([
        fetchYml(`${base}/latest.yml`),
        fetchYml(`${base}/latest-mac.yml`),
      ]);

      const winX64 = pickFile(winYml.files, /-win-x64\.exe$/i);
      const winArm64 = pickFile(winYml.files, /-win-arm64\.exe$/i);
      const macX64 = pickFile(macYml.files, /-mac-x64\.(dmg|zip)$/i, /\.dmg$/i);
      const macArm64 = pickFile(macYml.files, /-mac-arm64\.(dmg|zip)$/i, /\.dmg$/i);

      setVersionWin(winYml.version || undefined);
      setVersionMac(macYml.version || undefined);
      setLinks({
        winX64: winX64 ? toAbs(base, winX64) : undefined,
        winArm64: winArm64 ? toAbs(base, winArm64) : undefined,
        macX64: macX64 ? toAbs(base, macX64) : undefined,
        macArm64: macArm64 ? toAbs(base, macArm64) : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load latest downloads');
      setLinks({});
      setVersionWin(undefined);
      setVersionMac(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [base]);

  const auto = useMemo(() => pickAuto(links), [links]);

  return {
    loading,
    error,
    links,
    versionWin,
    versionMac,
    auto,
    refresh,
  };
}