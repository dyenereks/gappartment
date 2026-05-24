/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib from "../_lib.js";
import type * as billShares from "../billShares.js";
import type * as bills from "../bills.js";
import type * as expenseShares from "../expenseShares.js";
import type * as expenses from "../expenses.js";
import type * as notifications from "../notifications.js";
import type * as paymentMethods from "../paymentMethods.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _lib: typeof _lib;
  billShares: typeof billShares;
  bills: typeof bills;
  expenseShares: typeof expenseShares;
  expenses: typeof expenses;
  notifications: typeof notifications;
  paymentMethods: typeof paymentMethods;
  pushSubscriptions: typeof pushSubscriptions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
