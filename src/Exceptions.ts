import { Exception } from '@poppinss/utils';

export class AuthorizationException extends Exception {
  public constructor(message: string) {
    super(message, 403, 'E_AUTHORIZATION_DENIED');
  }
}
