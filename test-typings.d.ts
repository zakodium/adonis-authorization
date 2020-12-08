declare module '@ioc:Adonis/Addons/Authorization' {
  interface GlobalActions {
    'always-true': [];
    'always-true-guest': [];
    'always-false': [];
    'user-id': [number];
    'user-id-bool': [number, boolean];
  }
}

declare module '@ioc:Adonis/Addons/Auth' {
  export interface TestUser {
    id: number;
  }

  interface AuthContract {
    user: TestUser;
  }
}
