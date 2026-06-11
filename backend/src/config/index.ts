import dotenv from "dotenv";
dotenv.config();

export default {
  port: Number(process.env.PORT || 3001),
  dbUrl: process.env.DATABASE_URL || "",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  jwtSecret: process.env.JWT_SECRET || "secret",
};
