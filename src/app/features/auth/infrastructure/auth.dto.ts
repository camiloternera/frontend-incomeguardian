/** Shapes exactly as the backend sends them. Never leave this layer. */
export interface LoginResponseDto {
  UserId: string;
  Email: string;
  Name: string;
  AccessToken: string;
  RefreshToken: string;
  ExpiresAt: string;
}

export interface ConfirmedUserDto {
  id: string;
  state: boolean;
  name: string;
  surname: string;
  email: string;
  phoneNumber: string;
}
