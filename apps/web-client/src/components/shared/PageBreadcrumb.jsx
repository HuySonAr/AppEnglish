import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '../ui/breadcrumb.jsx';

export function PageBreadcrumb({ items }) {
  const shown = items.filter((item) => item && item.label);
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {shown.map((item, index) => {
          const last = index === shown.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              <BreadcrumbItem className={last ? 'max-w-[16rem] sm:max-w-md' : 'max-w-[10rem] sm:max-w-xs'}>
                {item.to && !last ? (
                  <BreadcrumbLink asChild className="truncate">
                    <Link to={item.to} state={item.state}>
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                ) : last ? (
                  <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </BreadcrumbItem>
              {last ? null : <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
