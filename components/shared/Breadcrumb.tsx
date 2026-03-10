import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

function truncateLabel(label: string, maxLength = 40): string {
  if (label.length <= maxLength) return label;
  return label.slice(0, maxLength - 1).trimEnd() + '\u2026';
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="-ml-2">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors whitespace-nowrap"
                >
                  {truncateLabel(item.label)}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? 'text-foreground font-medium truncate max-w-[280px]'
                      : 'whitespace-nowrap'
                  }
                  title={item.label.length > 40 ? item.label : undefined}
                >
                  {truncateLabel(item.label)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
