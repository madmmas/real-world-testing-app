import "altcha";

type CaptchaMode = "frictionless" | "interactive";

export default function AltchaField({ mode }: { mode: CaptchaMode }) {
  const interactive = mode === "interactive";
  return (
    <div className={interactive ? "rounded-md border border-slate-200 p-3" : undefined}>
      {interactive && (
        <p className="mb-2 text-sm text-slate-600">Interactive bot check</p>
      )}
      <altcha-widget
        key={mode}
        challenge={`/auth/captcha/challenge?mode=${mode}`}
        auto={interactive ? "off" : "onload"}
        display={interactive ? "standard" : "invisible"}
        type={interactive ? "checkbox" : "native"}
        hidelogo=""
        hidefooter=""
      />
    </div>
  );
}
