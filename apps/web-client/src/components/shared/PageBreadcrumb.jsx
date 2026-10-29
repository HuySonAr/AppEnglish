import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils.js';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '../ui/breadcrumb.jsx';

const chip = 'inline-flex h-7 min-w-0 items-center gap-1 rounded-md px-2 text-xs transition-colors';
const quiet = 'bg-muted/60 text-muted-foreground shadow-xs dark:shadow-none';

export function PageBreadcrumb({ items }) {
  const shown = items.filter((item) => item && item.label);
  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-1">
        {shown.map((item, index) => {
          const last = index === shown.length - 1;
          const Icon = item.icon;
          const content = (
            <>
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
              <span className="truncate">{item.label}</span>
            </>
          );
          return (
            <Fragment key={`${index}-${item.label}`}>
              <BreadcrumbItem className={last ? 'max-w-[16rem] sm:max-w-md' : 'max-w-40 sm:max-w-xs'}>
                {item.to && !last ? (
                  <BreadcrumbLink asChild className={cn(chip, quiet, 'hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring')}>
                    <Link to={item.to} state={item.state}>
                      {content}
                    </Link>
                  </BreadcrumbLink>
                ) : last ? (
                  <BreadcrumbPage className={cn(chip, 'bg-primary/10 font-medium text-primary')}>{content}</BreadcrumbPage>
                ) : (
                  <span className={cn(chip, quiet)}>{content}</span>
                )}
              </BreadcrumbItem>
              {last ? null : <BreadcrumbSeparator className="text-muted-foreground/60 [&>svg]:h-3 [&>svg]:w-3" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
