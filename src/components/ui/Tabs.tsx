import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  onValueChange?: (value: string) => void;
  /** Etiqueta accesible del conjunto de pestañas. */
  label: string;
}

export function Tabs({ items, value, onValueChange, label }: TabsProps) {
  const first = items[0]?.value ?? '';
  return (
    <TabsPrimitive.Root
      value={value ?? first}
      onValueChange={onValueChange}
      className={styles.root}
    >
      <TabsPrimitive.List className={styles.list} aria-label={label}>
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={styles.trigger}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value} className={styles.content}>
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
