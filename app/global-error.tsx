'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen flex items-center justify-center bg-neutral-900 text-white p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Terjadi Kesalahan Sistem</h2>
          <p className="text-xs text-neutral-400">{error.message || 'Silakan muat ulang halaman.'}</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl bg-amber-500 font-bold text-xs"
          >
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
