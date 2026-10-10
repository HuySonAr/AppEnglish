import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../components/ui/card.jsx';
import { cn } from '../../../lib/utils.js';

export function AuthCard({
  eyebrow = 'AppEnglish',
  title,
  description,
  children,
  className,
}) {
  return (
    <div className="flex w-full items-center justify-center">
      <Card className={cn('w-full max-w-md rounded-2xl shadow-lg', className)}>
        <CardHeader className="space-y-2 p-6 sm:p-8 sm:pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
          <CardTitle className="text-2xl sm:text-3xl">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

export function AuthLink({ children, ...props }) {
  return (
    <a
      className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
      {...props}
    >
      {children}
    </a>
  );
}
