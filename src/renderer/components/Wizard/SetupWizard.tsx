import { useState } from "react";
import { WizardStep1 } from "./WizardStep1";
import { WizardStep2 } from "./WizardStep2";
import { WizardStep3 } from "./WizardStep3";
import { WizardStep4 } from "./WizardStep4";
import { markWizardDone } from "../../ipc/backend";

interface BackendStatus {
  id: string;
  available: boolean;
  authenticated: boolean;
  loading: boolean;
}

interface Props {
  onComplete: () => void;
}

const STEP_LABELS: Record<number, string> = {
  1: "Setting up your tools",
  2: "Install additional tools",
  3: "Sign in to your AI tools",
  4: "Enter API keys",
};

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [statuses, setStatuses] = useState<BackendStatus[]>([]);

  const missing = statuses.filter((s) => !s.available).map((s) => s.id);

  const handleComplete = async () => {
    await markWizardDone();
    localStorage.setItem("wizardDone", "1");
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-xl p-8 motion-safe:animate-scale-in">
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ease-press ${step >= n ? "bg-primary" : "bg-bubble-strong"}`}
            />
          ))}
        </div>
        <div className="text-xs text-text-muted mb-8">
          Step {step} of 4 — {STEP_LABELS[step]}
        </div>
        {step === 1 && (
          <WizardStep1
            onNext={(s) => {
              setStatuses(s);
              setStep(2);
            }}
          />
        )}
        {step === 2 && (
          <WizardStep2
            missing={missing}
            onNext={() => setStep(3)}
            onBack={() => {
              setStatuses([]);
              setStep(1);
            }}
          />
        )}
        {step === 3 && (
          <WizardStep3
            statuses={statuses}
            onComplete={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <WizardStep4 onComplete={handleComplete} onBack={() => setStep(3)} />
        )}
      </div>
    </div>
  );
}
