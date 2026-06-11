import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import ApiError from "../utils/ApiError";
import httpStatus from "../utils/httpStatus";

export const validateQuery =
  (schema: Joi.ObjectSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query);
    if (error) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        error.details.map((d) => d.message).join(", ")
      );
    }
    req.query = value;
    next();
  };
