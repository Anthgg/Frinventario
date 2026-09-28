import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanBarcode } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { countingApi } from '@/api/counting';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export interface StartCountButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  campaignId: string;
  children?: ReactNode;
}

/**
 * Punto de entrada al conteo (FF003).
 *
 * Llama a POST /campaigns/{id}/count-sessions/start, que es idempotente:
 * si ya existe una sesión PENDING/IN_PROGRESS para tu asignación la devuelve
 * (already_started) en lugar de crear otra. Por eso el mismo botón sirve para
 * "Iniciar" y para "Continuar".
 */
export function StartCountButton({
  campaignId,
  children = 'Iniciar/Continuar conteo',
  ...rest
}: StartCountButtonProps) {
  const navigate = useNavigate();
  const { push } = useToast();
  const [pending, setPending] = useState(false);

  async function open() {
    if (pending) return;
    setPending(true);
    try {
      const session = await countingApi.start(campaignId);
      navigate(`/app/conteo/${session.id}`);
    } catch (error) {
      const apiError = ApiError.from(error);
      push({
        title: 'No pudimos abrir el conteo',
        description: apiError.message,
        tone: apiError.code === 'NETWORK_ERROR' ? 'warning' : 'danger',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="primary" loading={pending} onClick={() => void open()} {...rest}>
      <ScanBarcode size={17} aria-hidden="true" />
      {children}
    </Button>
  );
}
