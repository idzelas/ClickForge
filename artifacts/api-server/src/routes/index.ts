import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import userPreferencesRouter from "./userPreferences";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(userPreferencesRouter);

export default router;
