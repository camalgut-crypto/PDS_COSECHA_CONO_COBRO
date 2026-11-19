// Conexión a Supabase (proyecto de Tiempos DAC). La clave "publishable" es pública por diseño:
// la seguridad la dan las políticas de supabase/schema.sql (cada perfil solo descarga los archivos de sus pestañas).
// Con ?local en la dirección la app lee public/local/*.json (generados con actualizar.py --local o --prueba-excel)
// y permite elegir el perfil con ?local&rol=gerencia|cobro|comercial para revisar lo que ve cada uno.
window.CVC_CONFIG = {
  SUPABASE_URL: 'https://lzgteejsjxrbadsqlpnd.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_3v2gGe5N9Oh1eW-9ywMb1g_3Buo8af8',
  BUCKET: 'cvc',
  // Qué herramienta es esta copia: 'cuentas' = COBRO_CUENTAS · 'pds' = PDS_COSECHA_CONO_COBRO (mismo código y usuarios)
  HERRAMIENTA: 'pds',
  // Preguntas libres con Claude (tiene costo por uso de la API de Anthropic). En false solo quedan las preguntas
  // guiadas, que son gratis. Para activarla: crear la función cvc-preguntar con el secret ANTHROPIC_API_KEY y poner true.
  IA_CLAUDE: false,
};
