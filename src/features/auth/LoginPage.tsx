import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { sanitizeReturnTo } from '@/auth/returnUrl';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, PasswordInput } from '@/components/ui/Input';
import styles from './LoginPage.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Ingresa tu correo.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Revisa el formato del correo.';
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return 'Ingresa tu contraseña.';
  return undefined;
}

/** Mapea errores de API a un mensaje de login seguro (sin enumerar usuarios). */
function loginErrorMessage(error: ApiError): string {
  if (error.code === 'NETWORK_ERROR') return 'No se pudo conectar con el servidor.';
  if (error.status === 401) return 'Correo o contraseña incorrectos.';
  if (error.status === 403) return error.message;
  if (error.status >= 500) return error.message;
  return error.message;
}

export function LoginPage() {
  const { login, authenticated, sessionNotice, bootstrapError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = sanitizeReturnTo((location.state as { from?: string } | null)?.from);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ya autenticado en /login (p. ej. sesión restaurada): al destino seguro.
  if (authenticated) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return; // sin doble submit

    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    setFieldErrors({ email: nextEmailError, password: nextPasswordError });
    if (nextEmailError || nextPasswordError) return;

    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(ApiError.from(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card tone="glass" padding="lg" className={styles.card}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Iniciar sesión</h1>
          <p className={styles.subtitle}>Conteo, conciliación y documentos en un solo lugar.</p>
        </div>
      </header>

      <div className={styles.messages}>
        {sessionNotice ? (
          <Alert
            tone={sessionNotice === 'expired' ? 'warning' : 'danger'}
            title={
              sessionNotice === 'expired'
                ? 'Tu sesión ha expirado.'
                : 'Tu sesión no está disponible.'
            }
          >
            {sessionNotice === 'expired'
              ? 'Inicia sesión nuevamente.'
              : 'Tu usuario no tiene acceso en este momento.'}
          </Alert>
        ) : null}

        {error ? (
          <Alert tone="danger" title="No pudimos iniciar sesión">
            {loginErrorMessage(error)}
          </Alert>
        ) : bootstrapError ? (
          <Alert tone="warning" title="Sin conexión con el servidor">
            {bootstrapError.message}
          </Alert>
        ) : null}
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <Input
          label="Correo"
          type="email"
          name="email"
          autoComplete="username"
          placeholder="tu.correo@empresa.com"
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
          required
        />
        <PasswordInput
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={submitting}
          disabled={submitting}
        >
          Ingresar
          <ArrowRight size={16} />
        </Button>
      </form>

      <p className={styles.note}>
        Acceso con tu cuenta de Inventario Dedalo. Los datos de operación se cargan desde el
        servidor.
      </p>
    </Card>
  );
}
