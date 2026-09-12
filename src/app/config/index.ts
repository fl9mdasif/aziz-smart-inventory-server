import dotenv from 'dotenv';
import path from 'path';

// Development এ .env file থেকে আসে use for local development and production এ environment variable থেকে আসে
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
} else {
  dotenv.config();
}

// we got everything from .env by config the file
export default {
  NODE_ENV: process.env.NODE_ENV,
  port: process.env.PORT || 5000,
  database_url: process.env.DATABASE_URL,
  bcrypt_salt_round: process.env.BCRYPT_SALT_ROUND,
  default_pass: process.env.DEFAULT_PASS,
  super_admin_pass: process.env.SUPER_ADMIN_PASS,
  default_user_pass: process.env.DEFAULT_USER_PASS,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  reset_pass_link: process.env.RESET_PASS_LINK,
  cloud_name: process.env.CLOUD_NAME,
  cloud_api_Key: process.env.CLOUD_API_KEY,
  cloud_api_secret: process.env.CLOUD_API_SECRET,
  plunk_secret_key: process.env.PLUNK_SECRET_KEY,
  admin_email: process.env.ADMIN_EMAIL,
  site_url: process.env.SITE_URL || 'https://www.hydraazone.com',
};
