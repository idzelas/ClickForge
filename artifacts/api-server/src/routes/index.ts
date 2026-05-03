import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import userPreferencesRouter from "./userPreferences";
import svgDesignsRouter from "./svgDesigns";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(userPreferencesRouter);
router.use(svgDesignsRouter);

export default router;
