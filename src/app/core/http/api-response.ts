export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T | null;
  isSuccess: boolean;
  messageKey: string;
  errors: ApiError[];
}
