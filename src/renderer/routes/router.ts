// Modern Router - Simplified
// This signals-based approach allows components to subscribe to route changes.
// Since we use Wouter in the UI, this might just be a state holder or bridge if needed.
// For now, we keep it simple.

import { signal } from '@preact/signals';

export type RoutePath =
  | '/'
  | '/dashboard'
  | '/transactions'
  | '/budget'
  | '/goals'
  | '/settings'
  | '/onboarding';

export const currentRoute = signal<RoutePath>('/dashboard');

export const Router = {
  navigate: (path: RoutePath) => {
    currentRoute.value = path;
    // Integration with Wouter or window.location if strictly needed
    // But mostly Wouter handles its own state from window.location
  }
};