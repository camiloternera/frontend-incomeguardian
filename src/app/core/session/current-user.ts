import { Observable } from 'rxjs';

/** Datos del usuario con sesión que la interfaz necesita mostrar. */
export interface CurrentUserProfile {
  name: string;
  email: string;
}

/**
 * Puerto transversal: quién tiene la sesión abierta y cómo cerrarla.
 * Lo usa la UI compartida (el shell) sin depender del dominio `auth`, que es quien lo implementa.
 */
export abstract class CurrentUser {
  /** Perfil del usuario con sesión, o `null` si no hay sesión. */
  abstract profile(): CurrentUserProfile | null;

  /** Cierra la sesión de este dispositivo; siempre completa y deja la sesión local borrada. */
  abstract signOut(): Observable<void>;
}
