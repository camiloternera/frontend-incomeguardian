/**
 * Zona horaria IANA del navegador (por ejemplo `America/Bogota`), para que el correo
 * muestre la hora de vencimiento en la hora local del usuario. Si el navegador no la
 * expone se omite y el backend usa su zona por defecto.
 */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
