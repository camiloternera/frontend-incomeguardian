export interface NewUser {
  name: string;
  surname: string;
  email: string;
  password: string;
  phoneNumber: string;
  /** Zona horaria IANA con la que el correo muestra la hora de vencimiento del código. */
  timeZone?: string;
}
