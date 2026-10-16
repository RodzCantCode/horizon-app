// Las dos variables son públicas por diseño (van al navegador): la URL del proyecto y la clave
// publicable. La clave secreta (o service_role) no se usa en esta app.
export const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const clavePublicableSupabase = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
