import { Fragment, type ReactNode } from 'react';
import { navigate } from '../App';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export interface Crumb {
  label: ReactNode;
  to?: string;
}

/** The same top bar on every signed-in page: logo (home), where you are, and page actions on the right. */
export function AppHeader({ crumbs = [], children, theme = true }: { crumbs?: Crumb[]; children?: ReactNode; theme?: boolean }) {
  return (
    <header className="flex min-h-[40px] items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[15px]">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          aria-label="All websites"
          className="shrink-0 rounded-lg"
        >
          <Logo iconOnPhone={crumbs.length > 0} />
        </a>
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            <span className="text-stone-300" aria-hidden="true">
              /
            </span>
            {c.to ? (
              <a
                href={c.to}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(c.to!);
                }}
                className="flex min-w-0 items-center gap-2 font-medium text-stone-600 hover:text-ink"
              >
                {c.label}
              </a>
            ) : (
              <span className="flex min-w-0 items-center gap-2 truncate font-medium" aria-current="page">
                {c.label}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {theme && <ThemeToggle className="btn h-10 w-10 px-0" />}
      </div>
    </header>
  );
}
