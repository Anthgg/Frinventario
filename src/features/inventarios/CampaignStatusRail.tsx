import type { CampaignStatus } from '@/api/inventory';
import {
  CAMPAIGN_LIFECYCLE,
  STATUS_LABEL,
  isOffRamp,
  lifecycleIndex,
} from './campaignStatus';
import styles from './CampaignStatusRail.module.css';

export interface CampaignStatusRailProps {
  status: CampaignStatus;
}

/**
 * Firma de la fase: el hilo de oro de Ariadna recorriendo el laberinto de
 * estados. No es numeración decorativa — el orden es el del ciclo de vida real
 * del backend y lo que se marca es la posición ACTUAL de la campaña.
 * Los estados fuera del recorrido (vencida/cancelada) salen del hilo.
 */
export function CampaignStatusRail({ status }: CampaignStatusRailProps) {
  const currentIndex = lifecycleIndex(status);
  const offRamp = isOffRamp(status);

  return (
    <div className={styles.wrap}>
      <p className={styles.caption}>Recorrido de la campaña · estado actual marcado</p>
      <ol className={styles.rail} aria-label="Recorrido de estados de la campaña">
        {CAMPAIGN_LIFECYCLE.map((step, index) => {
          const isCurrent = !offRamp && index === currentIndex;
          const traversed = !offRamp && index < currentIndex;
          const mark = isCurrent ? 'current' : traversed ? 'done' : 'pending';
          return (
            <li
              key={step}
              className={styles.step}
              data-mark={mark}
              data-thread={index < currentIndex ? 'done' : 'pending'}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.label}>{STATUS_LABEL[step]}</span>
              {index < CAMPAIGN_LIFECYCLE.length - 1 ? (
                <span className={styles.thread} aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
      {offRamp ? (
        <p className={styles.offRamp} data-mark="off" aria-current="step">
          <span className={styles.dot} aria-hidden="true" />
          Fuera del recorrido · {STATUS_LABEL[status]}
        </p>
      ) : null}
    </div>
  );
}
