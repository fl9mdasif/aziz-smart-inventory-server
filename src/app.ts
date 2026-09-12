/* eslint-disable @typescript-eslint/no-explicit-any */
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
  'http://localhost:5173',
  // TODO: replace with Aziz Brothers' real production domain(s) once known
  // 'https://azizbrothers.com',
  // 'https://www.azizbrothers.com',
];

const corsOptions = {
  origin: function (origin: any, callback: any) {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
};

// ✅ Security headers (helmet)
app.use(helmet());

// ✅ Preflight OPTIONS request
// সঠিক (Express 5 এর জন্য)
// app.options('(.*)', cors(corsOptions));

// ✅ সব middleware এর আগে CORS
app.use(cors(corsOptions));

// ✅ Manual CORS header — CDN বা Firewall bypass
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie,X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(cookieParser());

// ✅ Strip Mongo-operator / dot-path injection attempts from body & params
app.use(sanitizeInput);

// application routes
app.use('/api/v1', router);

app.get('/', (req: Request, res: Response) => {
  res.send('aziz-brothers-server is running....');
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
