// =============================================================================
// Design Process Stepper Component
// Technical Building Block: P01 - Stepper Navigation (Size → Style → Details → Review)
// =============================================================================

import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Step {
  number: number;
  path: string;
  labelKey: string;
}

const steps: Step[] = [
  { number: 1, path: "/design/size", labelKey: "Size" },
  { number: 2, path: "/design/style", labelKey: "Style" },
  { number: 3, path: "/design/details", labelKey: "Details" },
  { number: 4, path: "/design/proposals", labelKey: "Review" },
];

export const DesignStepper = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getCurrentStep = () => {
    const currentStep = steps.find((step) => location.pathname.startsWith(step.path));
    return currentStep?.number || 1;
  };

  const current = getCurrentStep();

  const canNavigateToStep = (targetStep: number) => {
    // Can only navigate to completed steps or current step
    return targetStep <= current;
  };

  const handleStepClick = (step: Step) => {
    if (canNavigateToStep(step.number)) {
      navigate(step.path);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                onClick={() => handleStepClick(step)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  current >= step.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                  canNavigateToStep(step.number) && "cursor-pointer hover:scale-110"
                )}
              >
                {step.number}
              </div>
              <span
                className={cn(
                  "text-xs mt-2",
                  current >= step.number ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {step.labelKey}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 transition-colors",
                  current > step.number ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
