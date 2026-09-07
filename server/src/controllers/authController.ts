import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { AuthService } from "../services";
import { hashPassword, comparePassword } from "../utils/password";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../middleware/auth";
import { LoginSchema, RegisterSchema } from "@iqoo/shared";
import { AppError } from "../middleware/errorHandler";

export class AuthController {
  constructor(private authService: AuthService) {}

  async register(req: AuthRequest, res: Response) {
    const input = RegisterSchema.parse(req.body);

    const existingUser = await this.authService.getUserByEmail(input.email);
    if (existingUser) {
      throw new AppError(409, "User already exists", "USER_EXISTS");
    }

    const hashedPassword = await hashPassword(input.password);
    const user = await this.authService.createUser({
      email: input.email,
      name: input.name,
      password: hashedPassword,
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  }

  async login(req: AuthRequest, res: Response) {
    const input = LoginSchema.parse(req.body);

    const user = await this.authService.getUserByEmail(input.email);
    if (!user) {
      throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const passwordMatch = await comparePassword(input.password, (user as any).password);
    if (!passwordMatch) {
      throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    const { password: _, ...userWithoutPassword } = user as any;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      },
    });
  }

  async refresh(req: AuthRequest, res: Response) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError(400, "Refresh token is required", "MISSING_REFRESH_TOKEN");
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await this.authService.getUserById(payload.userId);

    if (!user) {
      throw new AppError(401, "User not found", "USER_NOT_FOUND");
    }

    const accessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  }

  async logout(req: AuthRequest, res: Response) {
    // In a real app, you'd invalidate the refresh token
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  }

  async getProfile(req: AuthRequest, res: Response) {
    if (!req.userId) {
      throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");
    }

    const user = await this.authService.getUserById(req.userId);
    res.json({
      success: true,
      data: { user },
    });
  }
}
