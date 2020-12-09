# Adonis Authorization

[![NPM version][npm-image]][npm-url]
[![build status][ci-image]][ci-url]
[![npm download][download-image]][download-url]

Authorization provider for AdonisJS.

| :warning: This module is unstable and in active development. Use at your own risk. |
| ---------------------------------------------------------------------------------- |

## Prerequisites

This provider requires Adonis v5 preview and won't work with Adonis v4.

## Installation

```console
npm i @zakodium/adonis-authorization
node ace invoke @zakodium/adonis-authorization
```

## Documentation

### Introduction

The API of this provider is heavily inspired from [Laravel's Authorization feature](https://laravel.com/docs/8.x/authorization),
though it was designed a bit differently to take TypeScript types into account.

Authorization is always asynchronous (returning promises), even if the methods are implemented using synchronous callbacks.

### Gates

#### Defining a gate

A gate is a simple callback function associated with a named action. It must return
a boolean or a Promise that resolves to a boolean. Any other value will be rejected
and result in a thrown Exception, to avoid security-impacting mistakes.

To write new gates:

- Edit the `GlobalActions` interface in `contracts/authorization.ts` to define the action name and eventual parameters.
- Define your gate callback in `start/authorization.ts`.

For example:

```ts
// contracts/authorization.ts
declare module '@ioc:Adonis/Addons/Authorization' {
  interface GlobalActions {
    'some-action': [];
  }
}

// start/authorization.ts
import { Gate } from '@ioc:Adonis/Addons/Authorization';

Gate.define('some-action', (user) => {
  return user.isAdmin;
});
```

##### Gate with parameters

A gate can define any number of parameters, that will be passed to the callback after the user object:

```ts
// contracts/authorization.ts
declare module '@ioc:Adonis/Addons/Authorization' {
  interface GlobalActions {
    'some-action': [number, boolean];
  }
}

// start/authorization.ts
import { Gate } from '@ioc:Adonis/Addons/Authorization';

import Post from 'App/Models/Post';

Gate.define('some-action', (user, post: Post, requireAdmin: boolean) => {
  if (requireAdmin) {
    return user.isAdmin;
  } else {
    return post.userId === user.id;
  }
});
```

##### Gate allowing guests

By default, gates do not allow guests (unauthenticated users). The gate callback
is not called and the gate behaves as if the callback returned `false`.

It is possible to opt into allowing guests, by passing `{ allowGuest: true }` while defining the gate.
In that case, the gate callback will be called for guests, with the `user` parameter being `null`.

```ts
import { Gate, User } from '@ioc:Adonis/Addons/Authorization';

Gate.define(
  'some-action',
  (user) => {
    if (!user) {
      // We have a guest.
      return false;
    }
    return user.isAdmin;
  },
  { allowGuest: true },
);
```

#### Using gates

TODO

### Policies

TODO

## License

[MIT](./LICENSE)

[npm-image]: https://img.shields.io/npm/v/@zakodium/adonis-authorization.svg
[npm-url]: https://www.npmjs.com/package/@zakodium/adonis-authorization
[ci-image]: https://github.com/zakodium/adonis-authorization/workflows/Node.js%20CI/badge.svg?branch=main
[ci-url]: https://github.com/zakodium/adonis-authorization/actions?query=workflow%3A%22Node.js+CI%22
[download-image]: https://img.shields.io/npm/dm/@zakodium/adonis-authorization.svg
[download-url]: https://www.npmjs.com/package/@zakodium/adonis-authorization
