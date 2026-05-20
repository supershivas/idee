import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-semibold">Idée</h1>
      <Link href="/login" className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800">
        Se connecter
      </Link>
    </main>
  )
}
