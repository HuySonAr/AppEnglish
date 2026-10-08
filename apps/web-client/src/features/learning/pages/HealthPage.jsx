import { useQuery } from '@tanstack/react-query';
import { getGatewayHealth } from '../../../lib/api/http-client.js';

export function HealthPage() {
  const query = useQuery({ queryKey: ['gateway-health'], queryFn: getGatewayHealth });
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-3 text-sm font-medium uppercase tracking-widest text-cyan-400">Bootstrap</p>
      <h1 className="text-4xl font-bold">Learning workspace ready</h1>
      <p className="mt-4 max-w-2xl text-slate-300">
        Product features will be added in later implementation phases. This screen
        verifies the React/Vite client and public gateway boundary.
      </p>
      <p className="mt-8 text-sm text-slate-400">
        Gateway: {query.isLoading ? 'checking…' : query.isError ? 'offline' : query.data?.status}
      </p>
    </section>
  );
}
