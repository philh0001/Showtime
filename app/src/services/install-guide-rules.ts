export type IPhoneInstallGuide = 'safari' | 'open-safari' | null;

export function getIPhoneInstallGuide({
  userAgent,
  standalone,
  dismissed,
}: {
  userAgent: string;
  standalone: boolean;
  dismissed: boolean;
}): IPhoneInstallGuide {
  if (standalone || dismissed || !/\biPhone\b/i.test(userAgent)) return null;
  return /Version\/[^ ]+.*Mobile\/[^ ]+.*Safari\//i.test(userAgent)
    && !/(?:CriOS|FxiOS|EdgiOS|OPiOS)\//i.test(userAgent)
    ? 'safari'
    : 'open-safari';
}
