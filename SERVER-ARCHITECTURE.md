# Server Architecture Reference — Express + TypeScript + MongoDB + Zod

**Purpose:** this is the reusable backend architecture spec for every new server project on this stack. Drop this file into a new project alongside `PRD.md` (what to build) and `claude.md` (build-phase checklist), and an AI agent should be able to scaffold and extend the codebase correctly **without reading any previous project's source code**. Everything it needs — file shapes, boilerplate, conventions, security setup — is here.

If a detail in a real project ever contradicts this file, the real project's working code wins — update this file to match, don't fight it.

---

## 0. Instructions for the AI agent (read this first)

When starting a new project with this file + `PRD.md` + `claude.md` present:

1. Read `PRD.md` for the feature list and any project-specific decisions (payment methods, auth model, third-party services).
2. Read `claude.md` for the phase plan / what's already done.
3. Scaffold the project skeleton from §2 and §4 of this file verbatim (package.json, tsconfig, app.ts, config, middlewares, utils) — these almost never change between projects.
4. For each feature/resource named in the PRD, generate a module following the exact template in §5 — same five/six files, same naming, same responsibilities per file. Do not invent a different shape.
5. Wire every new module into `routes/index.ts` (§4.6) immediately — a module that exists but isn't mounted is a real, easy-to-miss bug (it has happened before: an upload module sat fully coded but unreferenced for months).
6. After finishing a phase, update `claude.md`'s status section, not this file. This file describes *how* to build; `claude.md` tracks *what's been built*.
7. Never leave two competing implementations of the same feature live (e.g., an old insecure endpoint plus a new module). Replace, don't duplicate.
8. Default security posture (§8) is not optional — apply it in Phase 1 of any new project, not as a stretch goal.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Language | TypeScript, `strict: true` |
| Database | MongoDB via Mongoose |
| Validation | Zod, via a `validateRequest` middleware wired per-route |
| Auth | JWT (access + refresh), bcrypt password hashing |
| File uploads | AWS S3 pre-signed URLs (client uploads directly to the bucket) |
| Transactional email | HTTP-API based provider (e.g. Plunk) — simpler than SMTP, no Nodemailer needed |
| Security | `helmet`, `express-rate-limit`, a hand-written Mongo-injection sanitizer (see §8 for why not `express-mongo-sanitize`) |

Swap the database/validation/auth libraries only if the PRD explicitly calls for something else — otherwise keep this stack so every project reads the same way.

---

## 2. Folder structure

```
src/
  app.ts                     # Express app: security middleware, CORS, route mounting
  server.ts                  # Entry point: DB connect, seed, listen
  app/
    config/
      index.ts                # single source of truth for all env vars
    db/
      index.ts                # one-time seed logic (e.g. a default superAdmin)
    errors/
      AppErrors.ts             # AppError class
    interface/
      index.d.ts               # global Express.Request augmentation (req.user)
      error.ts                  # shared error-shape types
    middlewares/
      auth.ts                   # role-gated JWT auth
      validateRequest.ts         # Zod middleware wrapper
      sanitizeInput.ts            # Mongo-injection stripping
      rateLimiters.ts              # named rate limiters (auth, orders, ...)
      globalErrorHandler.ts         # final error → JSON response
      notFound.ts                    # 404 handler
      handleCastError.ts              # Mongoose CastError → AppError
      handleDuplicateError.ts          # Mongo E11000 → AppError
      handleValidationError.ts          # Mongoose ValidationError → AppError
      handleZodError.ts                  # ZodError → AppError
    utils/
      catchAsync.ts             # wraps async controllers
      sendResponse.ts            # standard response envelope
      jwt.ts                       # sign/verify helpers
      sendEmail.ts                   # thin wrapper around the email provider
    helpers/
      emailTemplate.ts            # HTML email bodies as functions
      <thirdPartyApi>.ts            # e.g. metaConversionApi.ts — one file per external API integration
    routes/
      index.ts                   # imports every module's router, mounts under /api/v1
    modules/
      <feature>/                  # one folder per feature — see §5
```

**Rule of thumb:** if a piece of logic is specific to one feature, it lives inside that feature's module. If it's shared plumbing (auth, error handling, response shape, config), it lives in `middlewares/`, `utils/`, or `config/`. Nothing feature-specific belongs in those shared folders.

---

## 3. Naming conventions

- Module folder: `src/app/modules/<name>/` (singular or plural to match the domain word — `order`, `category`, `cart` — stay consistent within a project)
- Files inside: `controller.<name>.ts`, `service.<name>.ts`, `model.<name>.ts`, `interface.<name>.ts`, `validation.<name>.ts`, and either `route.<name>.ts` or `router.<name>.ts` — **pick one spelling per project and use it everywhere**, don't mix both inside the same project (older codebases have both; that's tech debt, not a pattern to copy).
- Exported router name: `<name>Routes` (e.g. `export const orderRoutes = router;`).
- Exported service object: `<name>Services` (e.g. `export const orderServices = { ... };`), same for `<name>Controllers`, `<name>Validations`.
- Mongoose model export: PascalCase singular (`export const Order = model('Order', orderSchema);`).
- TypeScript interfaces: `T<Name>` for plain shapes (`TOrder`), `T<Name>Document` extends `Document`, `T<Name>Model` extends `Model<...>` when a schema needs static methods.
- Roles are lowerCamelCase string literals: `'user' | 'admin' | 'superAdmin'` (extend only if the PRD names more roles).

---

## 4. Core plumbing (copy nearly verbatim into every new project)

### 4.1 `package.json` scripts

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only --poll src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "express": "^5.1.0",
    "mongoose": "^8.x",
    "zod": "^4.x",
    "jsonwebtoken": "^9.x",
    "bcrypt": "^6.x",
    "cors": "^2.8.5",
    "cookie-parser": "^1.4.7",
    "dotenv": "^17.x",
    "http-status": "^2.x",
    "helmet": "^8.x",
    "express-rate-limit": "^8.x",
    "@aws-sdk/client-s3": "^3.x",
    "@aws-sdk/s3-request-presigner": "^3.x",
    "uuid": "^13.x"
  }
}
```

> **Do not add `express-mongo-sanitize`.** It reassigns `req.query`, which is a read-only getter under Express 5 and throws at request time. Use the hand-rolled sanitizer in §8 instead.

### 4.2 `tsconfig.json` — key options

```json
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

### 4.3 `src/app/config/index.ts`

```ts
import dotenv from 'dotenv';
import path from 'path';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
} else {
  dotenv.config();
}

export default {
  NODE_ENV: process.env.NODE_ENV,
  port: process.env.PORT || 5000,
  database_url: process.env.DATABASE_URL,
  bcrypt_salt_round: process.env.BCRYPT_SALT_ROUND,
  super_admin_pass: process.env.SUPER_ADMIN_PASS,
  default_user_pass: process.env.DEFAULT_USER_PASS,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  admin_email: process.env.ADMIN_EMAIL,
  site_url: process.env.SITE_URL || 'https://example.com',
  // add project-specific keys here (email provider key, AWS creds, etc.) —
  // never read process.env directly anywhere outside this file.
};
```

### 4.4 `src/app/errors/AppErrors.ts`

```ts
class AppError extends Error {
  public statusCode: number;

  constructor(statusCode: number, message: string, stack = '') {
    super(message);
    this.statusCode = statusCode;
    if (message) {
      this.message = message;
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
```

Usage: `throw new AppError(httpStatus.NOT_FOUND, 'Order not found', 'Order not found');` — second arg is the client-facing message, third is an internal detail/stack note.

### 4.5 `src/app/utils/catchAsync.ts`

```ts
import { NextFunction, Request, RequestHandler, Response } from 'express';

const catchAsync = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};

export default catchAsync;
```

Every controller function is wrapped in this — never write a bare `async (req, res) => {}` route handler.

### 4.6 `src/app/utils/sendResponse.ts` — the response envelope

```ts
import { Response } from 'express';

type TMeta = { page: number; limit: number; total: number };
type TResponse<T> = {
  statusCode: number;
  success: boolean;
  message?: string;
  meta?: TMeta;
  data: T;
};

const createSendResponse = <T>(res: Response, data: TResponse<T>) => {
  res.status(data.statusCode).json({
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
    data: data.data,
  });
};

const getSendResponse = <T>(res: Response, data: TResponse<T>) => {
  res.status(data.statusCode).json({
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
    meta: {
      page: parseInt(String(data.meta?.page)),
      limit: parseInt(String(data.meta?.limit)),
      total: parseInt(String(data.meta?.total)),
    },
    data: data.data,
  });
};

export const response = { createSendResponse, getSendResponse };
```

**Rule:** use `getSendResponse` only for paginated list endpoints (it requires `meta`); everything else uses `createSendResponse`. Every JSON response in the whole API has this exact shape — no endpoint invents its own envelope.

### 4.7 `src/app/middlewares/validateRequest.ts`

```ts
import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';

const validateRequest = (schema: any) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await schema.parseAsync({ body: req.body, cookies: req.cookies });
    next();
  });
};

export default validateRequest;
```

Every Zod schema used with this wraps its shape in `z.object({ body: z.object({ ... }) })` to match.

### 4.8 `src/app/middlewares/auth.ts` — role-gated JWT auth

```ts
import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import config from '../config';
import jwt, { JwtPayload } from 'jsonwebtoken';
import AppError from '../errors/AppErrors';
import { User } from '../modules/auth/model.auth';
import { TUserRole } from '../modules/auth/interface.auth';

const auth = (...requiredRoles: TUserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;
    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized Access', 'No token provided');
    }

    const decoded = jwt.verify(token, config.jwt_access_secret as string) as JwtPayload;
    const { role, email, iat } = decoded;

    const user = await User.isUserExists(email);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'This user no longer exists', 'No user found');
    }

    if (
      user.passwordChangedAt &&
      User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat as number)
    ) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized Access', 'Token issued before password change');
    }

    if (requiredRoles.length && !requiredRoles.includes(role)) {
      throw new AppError(httpStatus.FORBIDDEN, 'You do not have permission for this action', 'Role not allowed');
    }

    req.user = decoded as JwtPayload;
    next();
  });
};

export default auth;
```

Usage on a route: `auth(USER_ROLE.user, USER_ROLE.admin, USER_ROLE.superAdmin)` — name every role explicitly allowed, never leave it role-less unless the route is genuinely public (in which case, don't call `auth()` at all).

### 4.9 `src/app/interface/index.d.ts` — augment Express

```ts
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload;
    }
  }
}
```

### 4.10 `src/app/middlewares/globalErrorHandler.ts` (pattern)

Catches everything thrown/`next(err)`-ed anywhere in the app. Branches on error type — `AppError` → use its `statusCode`/`message`; `ZodError`/Mongoose `CastError`/`ValidationError`/duplicate-key (`code === 11000`) → convert via the matching `handle*Error.ts` helper into a consistent `{ success: false, message, errorDetails: { statusCode }, stack }` shape; anything else → 500. Keep `stack` out of the response in production (`NODE_ENV === 'production' ? null : err.stack`).

### 4.11 `src/app/middlewares/sanitizeInput.ts` — see full code in §8.2 (security section, since this exists specifically to close an injection vector).

### 4.12 `src/app/middlewares/rateLimiters.ts` — see §8.3.

### 4.13 `src/app.ts`

```ts
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import sanitizeInput from './app/middlewares/sanitizeInput';
import router from './app/routes';
import cookieParser from 'cookie-parser';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app: Application = express();

const allowedOrigins = [
  'http://localhost:3000',
  'https://YOUR-DOMAIN.com',
  'https://www.YOUR-DOMAIN.com',
];

const corsOptions = {
  origin: (origin: any, callback: any) => {
    if (!origin) return callback(null, true); // mobile apps / Postman / server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(sanitizeInput);

app.use('/api/v1', router);

app.get('/', (req: Request, res: Response) => res.send('server is running....'));

app.use(notFound);
app.use(globalErrorHandler);

export default app;
```

**Checklist whenever this file is copied into a new project:** update `allowedOrigins` to the real domain(s) on day one — a leftover previous-project domain here is the single most common copy-paste mistake.

### 4.14 `src/server.ts`

```ts
import config from './app/config';
import mongoose from 'mongoose';
import app from './app';
import { Server } from 'http';
import seedSuperAdmin from './app/db';

let server: Server;

async function main() {
  try {
    const con = await mongoose.connect(config.database_url as string);
    await seedSuperAdmin();
    console.log('Database connected successfully', con.connection.host);

    server = app.listen(config.port, () => {
      console.log(`Server listening on port ${config.port}`);
    });
  } catch (err) {
    console.log(err);
  }
}
main();

process.on('unhandledRejection', (reason) => {
  console.log('Unhandled rejection, shutting down...', reason);
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
});
```

### 4.15 `src/app/routes/index.ts` — module aggregator

```ts
import { Router } from 'express';
import { authRoute } from '../modules/auth/route.auth';
// import every other module's router here...

const router = Router();

const moduleRoute = [
  { path: '/auth', route: authRoute },
  // { path: '/categories', route: categoryRoutes },
  // ...one entry per module, path matching the domain plural/singular convention
];

moduleRoute.forEach((r) => router.use(r.path, r.route));

export default router;
```

**This file is the single most important thing to check after generating a new module.** A module with a perfectly correct controller/service/model that never gets added to this array is dead code that silently does nothing — it has happened in real projects on this stack (an upload module sat fully implemented but unmounted for months). After creating any module, immediately add it here and confirm with a quick request that the route responds.

---

## 5. The module template (repeat this exact shape for every feature)

Take a generic example resource called `widget` (rename for the real feature — `product`, `order`, `wishlist`, whatever the PRD calls it).

### `interface.widget.ts`

```ts
import { Document, Model, Types } from 'mongoose';

export interface TWidget {
  name: string;
  owner: Types.ObjectId;
  // ...fields per the PRD
}

export interface TWidgetDocument extends TWidget, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface TWidgetModel extends Model<TWidgetDocument> { }
```

### `model.widget.ts`

```ts
import { Schema, model } from 'mongoose';
import { TWidgetDocument, TWidgetModel } from './interface.widget';

const widgetSchema = new Schema<TWidgetDocument, TWidgetModel>(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// add compound/unique indexes here, next to the schema that needs them
// widgetSchema.index({ owner: 1, name: 1 }, { unique: true });

export const Widget = model<TWidgetDocument, TWidgetModel>('Widget', widgetSchema);
```

Sub-documents that appear inside a parent (an order's shipping address, a product's variants) are inlined as their own `new Schema({...})` right above the parent schema — never a separate model/collection unless the PRD needs to query them independently.

### `validation.widget.ts`

```ts
import { z } from 'zod';

const createWidgetValidationSchema = z.object({
  body: z.object({
    name: z.string({ message: 'Name is required' }).trim().min(1),
  }),
});

const updateWidgetValidationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).optional(),
  }),
});

export const widgetValidations = {
  createWidgetValidationSchema,
  updateWidgetValidationSchema,
};
```

### `service.widget.ts` — all business logic and DB access lives here, never in the controller

```ts
import httpStatus from 'http-status';
import AppError from '../../errors/AppErrors';
import { Widget } from './model.widget';
import { TWidget } from './interface.widget';

const createWidget = async (payload: TWidget) => {
  return Widget.create(payload);
};

const getAllWidgets = async (query: Record<string, unknown>) => {
  const { page = 1, limit = 20 } = query;
  const pageNum = Number(page);
  const limitNum = Number(limit);

  const [data, total] = await Promise.all([
    Widget.find({}).skip((pageNum - 1) * limitNum).limit(limitNum),
    Widget.countDocuments({}),
  ]);

  return { data, meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
};

const getSingleWidget = async (id: string) => {
  const widget = await Widget.findById(id);
  if (!widget) throw new AppError(httpStatus.NOT_FOUND, 'Widget not found', 'Widget not found');
  return widget;
};

const updateWidget = async (id: string, payload: Partial<TWidget>) => {
  const updated = await Widget.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!updated) throw new AppError(httpStatus.NOT_FOUND, 'Widget not found', 'Widget not found');
  return updated;
};

const deleteWidget = async (id: string) => {
  const deleted = await Widget.findByIdAndDelete(id);
  if (!deleted) throw new AppError(httpStatus.NOT_FOUND, 'Widget not found', 'Widget not found');
  return deleted;
};

export const widgetServices = {
  createWidget,
  getAllWidgets,
  getSingleWidget,
  updateWidget,
  deleteWidget,
};
```

### `controller.widget.ts` — thin, no business logic

```ts
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import { response } from '../../utils/sendResponse';
import { widgetServices } from './service.widget';

const createWidget = catchAsync(async (req, res) => {
  const result = await widgetServices.createWidget(req.body);
  response.createSendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Widget created successfully',
    data: result,
  });
});

const getAllWidgets = catchAsync(async (req, res) => {
  const result = await widgetServices.getAllWidgets(req.query);
  response.getSendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Widgets retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getSingleWidget = catchAsync(async (req, res) => {
  const result = await widgetServices.getSingleWidget(req.params.widgetId);
  response.createSendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Widget retrieved successfully', data: result });
});

const updateWidget = catchAsync(async (req, res) => {
  const result = await widgetServices.updateWidget(req.params.widgetId, req.body);
  response.createSendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Widget updated successfully', data: result });
});

const deleteWidget = catchAsync(async (req, res) => {
  const result = await widgetServices.deleteWidget(req.params.widgetId);
  response.createSendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Widget deleted successfully', data: result });
});

export const widgetControllers = { createWidget, getAllWidgets, getSingleWidget, updateWidget, deleteWidget };
```

### `route.widget.ts`

```ts
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../auth/const.auth';
import { widgetControllers } from './controller.widget';
import { widgetValidations } from './validation.widget';

const router = express.Router();

router.get('/', widgetControllers.getAllWidgets); // public example
router.get('/:widgetId', widgetControllers.getSingleWidget);

router.post(
  '/',
  auth(USER_ROLE.user, USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(widgetValidations.createWidgetValidationSchema),
  widgetControllers.createWidget,
);

router.patch(
  '/:widgetId',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(widgetValidations.updateWidgetValidationSchema),
  widgetControllers.updateWidget,
);

router.delete('/:widgetId', auth(USER_ROLE.admin, USER_ROLE.superAdmin), widgetControllers.deleteWidget);

export const widgetRoutes = router;
```

**Static paths before dynamic params:** if a module needs routes like `/my-widgets` or `/analytics/summary` alongside `/:widgetId`, register the static ones first — Express matches top-down, and a `:param` route with the same segment count will otherwise swallow the static path.

---

## 6. Auth & RBAC pattern

- Three roles by default: `user`, `admin`, `superAdmin` (`const.auth.ts`: `export const USER_ROLE = { user: 'user', admin: 'admin', superAdmin: 'superAdmin' } as const;`). Extend only if the PRD names more.
- JWT payload carries `{ _id, username, email, role }` — enough for `auth.ts` to check roles and for controllers to read `req.user._id`/`req.user.role` without a DB round-trip.
- `passwordChangedAt` on the user model + the `isJWTIssuedBeforePasswordChanged` static invalidates old tokens the moment a password changes — copy this pattern into any new project's user model.
- A `superAdmin` is seeded once on boot (`app/db/index.ts`) if none exists, from `SUPER_ADMIN_PASS` in env — never hardcode a plaintext admin password in source.
- **Guest checkout pattern** (for e-commerce specifically, when the PRD wants "no signup required to order"): a `POST /auth/guest-checkout` endpoint that finds-or-creates a user by email with a default password. Critical rule: if the email **already exists**, do **not** issue a token — respond with an error asking the caller to log in instead. Silently logging in an existing account from just an email (no password check) is an account-takeover hole; this exact bug has shipped before on this stack and must be checked for in every new project that copies this pattern.

---

## 7. Common e-commerce modules (reference — build only what the PRD asks for)

| Module | One-line responsibility |
|---|---|
| `auth` | register, login, logout, refresh, change-password, guest-checkout |
| `user` | profile (`/me`), saved addresses (capped, one default), superAdmin user management |
| `category` | CRUD + `slug` + SEO meta fields |
| `product` | CRUD + variants (name/SKU/price/discountPrice/stock/images/attributes) + `rating`/`reviewCount` as aggregates maintained by `review`, not set directly |
| `cart` | one doc per user, `{ product, variantId, quantity }[]` |
| `order` | snapshot pricing/SKU at order time, deduct stock, clear cart, status lifecycle + `statusHistory`, admin analytics |
| `wishlist` | one doc per user, `{ product, addedAt }[]`, mirrors `cart`'s shape |
| `review` | gate on "owns a delivered order containing this item", `pending/approved/rejected`, recalculate product rating **only from approved reviews**, never a running average that rejections can't undo |
| `settings` | one singleton document for admin-editable config (marketing pixel IDs, shipping rate, feature thresholds) — `GET` public with secrets stripped, `PATCH` admin-only |
| `upload` | pre-signed S3 URL generation — **must** be behind `auth()`, an open pre-signed-URL endpoint is a write-anywhere-in-the-bucket vector |
| `sitemap` | `GET /sitemap.xml` at the app root (not under `/api/v1`), built from active products/categories |

Don't scaffold a module the PRD doesn't ask for. Don't leave two implementations of the same feature (an old inline stub plus a new proper module) both live — replace and remove the old one.

---

## 8. Security checklist (apply from Phase 1, every project)

1. **CORS** — explicit allowlist of real domains, never `origin: '*'` with `credentials: true`.
2. **`helmet()`** — one line in `app.ts`, no config needed to start.
3. **Rate limiting** on auth endpoints and any endpoint that creates a resource for free (orders, registrations) — see 8.3.
4. **Input sanitization** against Mongo operator injection — see 8.2. **Do not use `express-mongo-sanitize` on Express 5** (it reassigns `req.query`, which is a read-only getter and throws). Use the custom version below instead.
5. **Every mutating route validated** with Zod via `validateRequest` — no controller should trust `req.body` shape without it.
6. **Every protected route names its allowed roles explicitly** — `auth()` with no roles, or a route with no `auth()` at all, should be a deliberate, reviewed decision, not an oversight.
7. **Secrets never returned by public GET endpoints** — e.g. a `settings` module's public projection must exclude API tokens/secrets even if the same document stores them for internal use.
8. **New file-upload / webhook endpoints reviewed for auth** before merging — these are exactly the kind of route that gets added, works locally, and ships without an auth check because "it's just for the admin panel."

### 8.1 Rate limiters (`middlewares/rateLimiters.ts`)

```ts
import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: 'Too many attempts. Please try again later.' },
});

export const orderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: 'Too many orders placed from this device. Please try again later.' },
});
```

Apply `authRateLimiter` to every route under `/auth`, and a resource-creation limiter (like `orderRateLimiter`) to any endpoint that lets an unauthenticated or newly-created account spend server/inventory resources.

### 8.2 Mongo-injection sanitizer (`middlewares/sanitizeInput.ts`)

```ts
import { NextFunction, Request, Response } from 'express';

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      cleaned[key] = sanitizeValue(val);
    }
    return cleaned;
  }
  return value;
};

const sanitizeInPlace = (target: Record<string, unknown> | undefined) => {
  if (!target || typeof target !== 'object') return;
  const sanitized = sanitizeValue(target) as Record<string, unknown>;
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, sanitized);
};

// req.query is a read-only getter under Express 5 — never reassign it.
// Only req.body/req.params are safe (and necessary) to sanitize in place.
const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.params as unknown as Record<string, unknown>);
  next();
};

export default sanitizeInput;
```

### 8.3 Why not third-party Mongo sanitizer packages

`express-mongo-sanitize` (and similar) try to reassign `req.query` to a cleaned object. Express 5 defines `req.query` as a getter with no setter, so `req.query = x` throws a `TypeError` at request time — every request 500s. Either patch around it, pin Express to v4, or (simpler, done above) write the ~20-line sanitizer that only ever mutates objects in place and never reassigns `req.query`.

---

## 9. Deployment templates

**`Dockerfile`**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5000
CMD [ "npm", "start" ]
```

**`docker-compose.yml`**
```yaml
services:
  backend:
    build: .
    ports:
      - "5000:5000"
    env_file:
      - ./.env
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev
```

**`vercel.json`** (if deploying to Vercel)
```json
{
  "version": 2,
  "builds": [{ "src": "dist/server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "dist/server.js" }]
}
```

---

## 10. What this file deliberately leaves out

- Exact fields for domain modules (`product`, `order`, etc.) — those come from the project's `PRD.md`, not this file.
- Frontend anything — this is a backend-only reference.
- Payment gateway integration specifics — wire up whichever gateway the PRD names, following the same module template.

When a new project needs a pattern that isn't here yet (a second sanitizer edge case, a new kind of module, a deployment target), add it to this file once it's proven working — that's what keeps future projects cheap to bootstrap.
