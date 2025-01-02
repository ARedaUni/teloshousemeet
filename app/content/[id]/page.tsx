import { Suspense } from 'react';
import { ContentDisplay } from './ContentDisplay';
import Loading from './loading';

export const revalidate = 3600; // Cache for 1 hour

export default async function Content({ params }: { params: Promise<{ id: string }> }) {
  // Await the params to resolve the promise
  const { id } = await params;

  return (
    <main className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={<Loading />}>
          <ContentDisplay id={id} />
        </Suspense>
      </div>
    </main>
  );
}
