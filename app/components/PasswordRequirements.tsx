import { getPasswordRequirementResults } from "@/app/lib/passwordPolicy";

export function PasswordRequirements({ password }: { password: string }) {
  const requirements = getPasswordRequirementResults(password);

  return (
    <div className="mt-2" aria-live="polite" aria-label="Passwortregeln">
      <p className="text-xs font-semibold text-slate-700">Passwortregeln</p>
      <ul className="mt-1 space-y-1 text-xs">
        {requirements.map((requirement) => (
          <li key={requirement.id} className={requirement.met ? "text-emerald-700" : "text-slate-600"}>
            <span aria-hidden="true" className="mr-1.5 font-bold">{requirement.met ? "✓" : "○"}</span>
            <span>{requirement.met ? "Erfüllt: " : "Offen: "}{requirement.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
