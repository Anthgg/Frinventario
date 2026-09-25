import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, PasswordInput } from '@/components/ui/Input';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { login, signInDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(ApiError.from(caught));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDemo() {
    signInDemo();
    navigate(from, { replace: true });
  }

  return (
    <Card tone="glass" padding="lg" className={styles.card}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Iniciar sesión</h1>
          <p className={styles.subtitle}>Conteo, conciliación y documentos en un solo lugar.</p>
        </div>
        <Badge tone="hilo">UI_MOCK</Badge>
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <Input
          label="Correo"
          type="email"
          name="email"
          autoComplete="username"
          placeholder="tu.correo@empresa.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <PasswordInput
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error ? (
          <Alert tone="danger" title="No pudimos iniciar sesión">
            {error.message}
          </Alert>
        ) : null}

        <Button type="submit" variant="primary" size="lg" block loading={submitting}>
          Ingresar
          <ArrowRight size={16} />
        </Button>
      </form>

      <div className={styles.divider} role="separator">
        <span>o</span>
      </div>

      <Button variant="secondary" size="lg" block onClick={handleDemo}>
        <FlaskConical size={16} />
        Entrar en modo demostración
      </Button>

      <p className={styles.note}>
        En FF000, el formulario inicia una sesión local <span className="mono">UI_MOCK</span>;
        no valida ni envía credenciales. La autenticación real llega en FF001.
      </p>
    </Card>
  );
}
