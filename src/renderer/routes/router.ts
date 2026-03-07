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
  },
};
