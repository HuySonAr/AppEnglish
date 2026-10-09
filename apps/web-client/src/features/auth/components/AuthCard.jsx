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
      <Card className={cn('w-full max-w-md', className)}>
        <CardHeader className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">{children}</CardContent>
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
