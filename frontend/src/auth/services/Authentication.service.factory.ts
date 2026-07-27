import { AuthenticationService } from "./Authentication.service";

export class AuthenticationServiceFactory {
  static getCurrentAuthenticationService(): AuthenticationService {
    return AuthenticationService.getInstance();
  }
}
