export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  UserId: string;
  Email: string;
  Name: string;
  AccessToken: string;
  RefreshToken: string;
  ExpiresAt: string;
}
