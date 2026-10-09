import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button.jsx';

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl px-6 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="mt-3 text-4xl font-bold">Page not found</h1>
      <Button variant="link" asChild className="mt-8">
        <Link to="/">Return home</Link>
      </Button>
    </section>
  );
}