import { appEnvironment, appVersion } from "@/app/lib/appVersion";

type AppVersionProps = {
  compact?: boolean;
};

function getEnvironmentLabel(environment: string) {
  if (environment === "production") return "Produktion";
  if (environment === "preview") return "Vorschau";
  if (environment === "development") return "Entwicklung";

  return environment;
}

export function AppVersion({ compact = false }: AppVersionProps) {
  if (compact) {
    return (
      <span className="text-xs text-slate-500">
        v{appVersion} · {getEnvironmentLabel(appEnvironment)}
      </span>
    );
  }

  return (
    <div className="text-xs leading-relaxed text-slate-500">
      <div className="font-medium text-slate-700">ungegoogelt</div>
      <div>Version {appVersion}</div>
      <div>{getEnvironmentLabel(appEnvironment)}</div>
    </div>
  );
}
