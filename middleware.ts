import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. On crée une réponse de base
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. On initialise le client Supabase avec la nouvelle logique de cookies sécurisée
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. On récupère l'utilisateur
  const { data: { user } } = await supabase.auth.getUser()

  // 4. Ta règle de protection : si pas d'utilisateur et qu'on veut aller sur /app, redirection.
  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/app/:path*'],
}
