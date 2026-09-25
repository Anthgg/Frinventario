import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/ui/State';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Contención global: un fallo de render no tira la app entera. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Solo consola: nunca se muestra al usuario.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 'var(--sp-8)', maxWidth: 560, margin: '0 auto' }}>
          <ErrorState
            title="Algo salió mal en esta pantalla"
            description="La sección no pudo renderizar. Puedes reintentar sin recargar la aplicación."
            onRetry={this.reset}
            retryLabel="Reintentar"
          />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="ghost"
              onClick={() => {
                window.location.reload();
              }}
            >
              Recargar aplicación
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
