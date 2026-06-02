'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AccomplishRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  useEffect(() => {
    if (tenantSlug) {
      router.replace(`/${tenantSlug}/workspace`);
    }
  }, [tenantSlug, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirigiendo al Workspace...</p>
      </div>
    </div>
  );
}
