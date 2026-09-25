import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './Field.module.css';

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor: string;
  hintId?: string;
  errorId?: string;
  children: ReactNode;
}

function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  hintId,
  errorId,
  children,
}: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Renderiza sin label visible (usa aria-label). */
  hideLabel?: boolean;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel = false, mono = false, required, id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  const control = (
    <input
      ref={ref}
      id={inputId}
      className={[styles.input, mono ? styles.mono : '', className].filter(Boolean).join(' ')}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );

  if (hideLabel) {
    return (
      <div className={styles.field}>
        {control}
        {error ? (
          <p className={styles.error} id={`${inputId}-error`} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      hintId={`${inputId}-hint`}
      errorId={`${inputId}-error`}
    >
      {control}
    </FieldShell>
  );
});

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Texto del botón mostrar/ocultar. */
  toggleLabel?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, hint, error, hideLabel, toggleLabel, id, ...rest }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    const control = (
      <div className={styles.withToggle}>
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-label={visible ? 'Ocultar contraseña' : (toggleLabel ?? 'Mostrar contraseña')}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );

    if (hideLabel) {
      return <div className={styles.field}>{control}</div>;
    }

    return (
      <FieldShell
        label={label}
        hint={hint}
        error={error}
        htmlFor={inputId}
        hintId={`${inputId}-hint`}
        errorId={`${inputId}-error`}
      >
        {control}
      </FieldShell>
    );
  },
);

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const describedBy = error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={textareaId}
      hintId={`${textareaId}-hint`}
      errorId={`${textareaId}-error`}
    >
      <textarea
        ref={ref}
        id={textareaId}
        className={[styles.input, styles.textarea, className].filter(Boolean).join(' ')}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </FieldShell>
  );
});
