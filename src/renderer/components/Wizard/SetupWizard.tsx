import { useState } from "react";
import { WizardStep1 } from "./WizardStep1";
import { WizardStep2 } from "./WizardStep2";
import { WizardStep3 } from "./WizardStep3";
import { markWizardDone } from "../../ipc";

interface BackendStatus {
  id: string;
  available: boolean;
  authenticated: boolean;
  loading: boolean;
}

interface Props {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [statuses, setStatuses] = useState<BackendStatus[]>([]);

  const handleStep1 = (s: BackendStatus[]) => {
    setStatuses(s);
    setStep(2);
  };
  const handleStep2 = () => setStep(3);
  const handleComplete = async () => {
    await markWizardDone();
    localStorage.setItem("wizardDone", "1");
    onComplete();
  };

  const missing = statuses.filter((s) => !s.available).map((s) => s.id);

  const STEP_LABELS: Record<number, string> = {
    1: "Setting up your tools",
    2: "Install additional tools",
    3: "Sign in to your AI tools",
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
        <div className="flex gap-1 mb-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ease-press ${step >= n ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`}
            />
          ))}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 mb-8">
          Step {step} of 3 — {STEP_LABELS[step]}
        </div>
        {step === 1 && <WizardStep1 onNext={handleStep1} />}
        {step === 2 && <WizardStep2 missing={missing} onNext={handleStep2} />}
        {step === 3 && (
          <WizardStep3 statuses={statuses} onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}
