import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { AuthController } from "../controllers/authController";
import { AuthService } from "../services";
import { UserRepository } from "../repositories";

const router = Router();

const userRepo = new UserRepository();
const authService = new AuthService(userRepo);
const authController = new AuthController(authService);

// Auth routes
router.post("/register", (req, res, next) => {
  authController.register(req, res).catch(next);
});

router.post("/login", (req, res, next) => {
  authController.login(req, res).catch(next);
});

router.post("/refresh", (req, res, next) => {
  authController.refresh(req, res).catch(next);
});

router.post("/logout", authenticateToken, (req, res, next) => {
  authController.logout(req, res).catch(next);
});

router.get("/profile", authenticateToken, (req, res, next) => {
  authController.getProfile(req, res).catch(next);
});

export default router;
