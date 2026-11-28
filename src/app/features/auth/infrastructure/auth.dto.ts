/** Shapes exactly as the backend sends them. Never leave this layer. */
/** Llega dentro del sobre `ApiResponse`, en camelCase como el resto de la API. */
export interface LoginResponseDto {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  theme?: string;
  language?: string;
}

/** `data` del 202 del registro y del 200 del reenvío del código; fechas en ISO UTC. */
export interface RegistrationRequestedDto {
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
}

/** `errors[0].data` de los errores de verificación que traen datos. */
export interface VerificationErrorDataDto {
  resendAvailableAt?: string;
  remainingAttempts?: number;
}

export interface ConfirmedUserDto {
  id: string;
  state: boolean;
  name: string;
  surname: string;
  email: string;
  phoneNumber: string;
}
