import type { NextConfig } from "next";


// Check required environment variables at backend startup
const requiredEnvVars = [
  'GOOGLE_PROJECT_ID',
  'GOOGLE_CREDENTIALS_PATH',
  'GOOGLE_MAPS_ACCESS_TOKEN',
  'GOOGLE_PROJECT_REGION'
];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

const nextConfig: NextConfig = {
  turbopack: {
    root: "/Users/matewolf/projects/shoppingassistant-demo",
  }
};

export default nextConfig;
