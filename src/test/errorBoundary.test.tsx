import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/app/ErrorBoundary';

function CrashingPage(): ReactNode {
  throw new Error('private component stack detail');
}

describe('ErrorBoundary', () => {
  it('shows a safe retry fallback without exposing error details', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <CrashingPage />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Algo salió mal en esta pantalla')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByText('private component stack detail')).not.toBeInTheDocument();
  });
});
