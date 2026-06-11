import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import httpStatus from "../utils/httpStatus";
import { Prisma } from "../../lib/prisma";
export default function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(httpStatus.BAD_REQUEST).json({
      message: "Database request error",
    });
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return res.status(httpStatus.INTERNAL).json({
      message: "Database error occurred",
    });
  }
  return res
    .status(httpStatus.INTERNAL)
    .json({ message: err.message || "Internal Server Error" });
}
