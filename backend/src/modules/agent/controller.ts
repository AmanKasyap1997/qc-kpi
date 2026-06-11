import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import httpStatus from "../../utils/httpStatus";
import agentService from "./service";

// Get All Agents
export const getAgent = catchAsync(async (req: Request, res: Response) => {
  const agents = await agentService.getAgents();

  res.status(httpStatus.OK).json({
    success: true,
    data: agents,
  });
});

// Create Agent
export const addAgent = catchAsync(async (req: Request, res: Response) => {
  const {
    name,
    email,
    phone,
    departmentId,
    callerReadyExtensionId,
    active,
  } = req.body;

  if (!name || !phone || !departmentId || !callerReadyExtensionId) {
    throw new Error(
      "Name, phone, departmentId and callerReadyExtensionId are required"
    );
  }

  const agent = await agentService.createAgent({
    name,
    email,
    phone,
    departmentId: Number(departmentId),
    callerReadyExtensionId,
    active,
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Agent created successfully",
    data: agent,
  });
});

// Update Agent
export const updateAgent = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const agent = await agentService.updateAgent(id, {
    ...req.body,
    ...(req.body.departmentId && {
      departmentId: Number(req.body.departmentId),
    }),
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: "Agent updated successfully",
    data: agent,
  });
});

// Soft Delete Agent
export const deleteAgent = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  await agentService.deleteAgent(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Agent deleted successfully",
  });
});

export default {
  getAgent,
  addAgent,
  updateAgent,
  deleteAgent,
};