import { useEffect, type ReactNode } from 'react';

/** Centered dialog on desktop, bottom sheet on phones. The header stays put and only the body scrolls. */
export function Modal({
  open,
  onClose,
  children,
  width = 'max-w-2xl',
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  title?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#1c1917]/30 backdrop-blur-[2px] dark:bg-black/60 sm:items-start sm:p-10"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`card flex max-h-[92dvh] shadow-2xl w-full ${width} animate-[sheet-up_.22s_ease-out] flex-col overflow-hidden rounded-b-none p-0 motion-reduce:animate-none sm:max-h-[calc(100dvh-5rem)] sm:animate-none sm:rounded-b-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-stone-300 sm:hidden" aria-hidden="true" />
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 px-5 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0 truncate text-lg font-semibold">{title}</div>
            <button className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-ink" onClick={onClose} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
          </div>
        )}
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">{children}</div>
      </div>
    </div>
  );
}
