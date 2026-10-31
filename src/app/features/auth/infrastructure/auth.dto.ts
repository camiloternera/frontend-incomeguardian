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

export interface ConfirmedUserDto {
  id: string;
  state: boolean;
  name: string;
  surname: string;
  email: string;
  phoneNumber: string;
}
