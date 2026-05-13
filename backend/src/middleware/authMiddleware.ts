import type { NextFunction, Request, Response } from "express";
import { supabaseAuthClient } from "../db/supabaseAdmin.js";

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    email?: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing authorization token"
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const { data, error } = await supabaseAuthClient.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    req.authUser = {
      id: data.user.id,
      email: data.user.email
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
