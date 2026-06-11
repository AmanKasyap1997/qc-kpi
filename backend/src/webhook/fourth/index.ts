import catchAsync from "../../utils/catchAsync";
import { Request, Response } from 'express';
import { logWebhook } from '../webhookLogger';

export const captureFourthRawBody = catchAsync(async (req: Request, res: Response): Promise<Response | void> => {
    console.log(req.body, 'req.body');
});
