import { useEffect, useState, type ReactNode } from 'react';

/**
 * Two-click confirm. Native confirm()/prompt() return false at once in some embedded browsers
 * (the Claude app's browser pane, some in-app webviews), which silently cancelled the action.
 */
export function ConfirmButton({
  className,
  confirmLabel = 'Click again to confirm',
  onConfirm,
  children,
}: {
  className?: string;
  confirmLabel?: ReactNode;
  onConfirm: () => unknown;
  children: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
