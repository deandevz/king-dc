import type { JSX } from 'react';
import { OnboardingForm } from '@/features/profile/OnboardingForm';
import { ToastProvider } from '@/features/shell/toast';

export default function OnboardingPage(): JSX.Element {
  return (
    <ToastProvider>
      <OnboardingForm />
    </ToastProvider>
  );
}
