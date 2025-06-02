import { Link, useRouteError } from 'react-router-dom';

export default function NotFoundPage() {
  const error = useRouteError() as any; // Basic error handling
  console.error(error);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <h1 className="text-6xl font-bold mb-4">Oops!</h1>
      <p className="text-2xl mb-2">Sorry, an unexpected error has occurred.</p>
      <p className="text-xl text-muted-foreground mb-8">
        <i>{error?.statusText || error?.message || 'Page not found'}</i>
      </p>
      <Link to="/" className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
        Go Home
      </Link>
    </div>
  );
} 