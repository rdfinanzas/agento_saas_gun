import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Accomplish SaaS</h1>
      <p className="text-muted-foreground mb-8">
        Multi-tenant platform with WhatsApp integration
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Iniciar Sesión
        </Link>
        <Link
          href="/admin"
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Admin Panel
        </Link>
      </div>
    </main>
  );
}
