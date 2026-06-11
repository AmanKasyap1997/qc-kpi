import { Request, Response, NextFunction } from "express";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export function verifyForthSignature(
  req: RawBodyRequest,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.API_KEY;

  if (!secret) {
    console.warn(
      "[ForthWebhook] API_KEY not set — skipping signature check"
    );
    next();
    return;
  }

  // Correct
  const rawBody = req.body;
  if (!rawBody) {
    res.status(400).json({
      error: "Missing raw body for signature verification",
    });
    return;
  }

  const signature =
    req.header("x-api-key");

  if (!signature) {
    res.status(401).json({
      error: "Missing API key in webhook signature header",
    });
    return;
  }
  try {
    const isValid =signature == process.env.API_KEY
    if (!isValid) {
      res.status(401).json({
        error: "Invalid API key webhook signature",
      });
      return;
    }
  } catch (error) {
    res.status(401).json({
      error: "Signature verification error",
    });
    return;
  }

  next();
}