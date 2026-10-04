export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T | null;
  isSuccess: boolean;
  /**
   * The backend spells the envelope message both ways depending on the endpoint
   * (`messageKey` on the login failure, `message` on the user endpoints), so both
   * are optional and `resolveApiError` reads whichever arrived.
   */
  message?: string;
  messageKey?: string;
  errors: ApiError[];
}
