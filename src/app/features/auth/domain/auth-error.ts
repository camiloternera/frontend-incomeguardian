/** A business failure from the auth flow, already carrying the copy to show. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
