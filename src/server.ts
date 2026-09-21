import config from './app/config';
import mongoose from 'mongoose';
import app from './app';
import { Server } from 'http';
import seedSuperAdmin from './app/db';

let server: Server;
async function main() {
  try {

   
   const con= await mongoose.connect(config.database_url as string);
    await seedSuperAdmin();

    console.log('Database connected successfully', `${con.connection.host}`);

    // console.log("Checking Environment Variables...");
  // console.log("DATABASE_URL process.:", process.env.DATABASE_URL);
  // console.log("DATABASE_URL - config. :", config.database_url);


    server = app.listen(config.port, () => {
      console.log(`Example app listening on port ${config.port}`);
    });
  } catch (err) {
    // Fail fast on boot errors (e.g. bad DATABASE_URL) instead of leaving
    // an unlistening process alive — a process manager can't restart what
    // never exits.
    console.log(err);
    process.exit(1);
  }
}
main();

process.on('unhandledRejection', (reason, promise) => {
  console.log(
    `😈 unhandledRejection is detected , shutting down ...`,
    reason,
    'promise: ',
    promise,
  );
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

// process.on('uncaughtException', () => {
//   console.log(`😈 uncaughtException is detected , shutting down ...`);
//   process.exit(1);
// });
// Promise.reject();
