import { prisma } from "../../../lib/prisma";
import ApiError from "../../utils/ApiError";
import httpStatus from "../../utils/httpStatus";

class AgentService {
  async getAgents() {
    return prisma.agent.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        department: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async createAgent(data: {
    name: string;
    email?: string;
    phone: string;
    departmentId: number;
    callerReadyExtensionId: string;
    active?: boolean;
  }) {
    const existingAgent = await prisma.agent.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { phone: data.phone },
          ...(data.email ? [{ email: data.email }] : []),
        ],
      },
    });

    if (existingAgent) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Agent with this email or phone already exists"
      );
    }

    return prisma.agent.create({
      data: {
        ...data,
        active: data.active ?? true,
      },
    });
  }

  async updateAgent(
    id: number,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      departmentId?: number;
      callerReadyExtensionId?: string;
      active?: boolean;
    }
  ) {
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!existingAgent) {
      throw new ApiError(httpStatus.NOT_FOUND, "Agent not found");
    }

    if (data.email || data.phone) {
      const duplicateAgent = await prisma.agent.findFirst({
        where: {
          id: {
            not: id,
          },
          deletedAt: null,
          OR: [
            ...(data.email ? [{ email: data.email }] : []),
            ...(data.phone ? [{ phone: data.phone }] : []),
          ],
        },
      });

      if (duplicateAgent) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Email or phone already exists"
        );
      }
    }

    return prisma.agent.update({
      where: { id },
      data,
    });
  }

  async deleteAgent(id: number) {
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!existingAgent) {
      throw new ApiError(httpStatus.NOT_FOUND, "Agent not found");
    }

    return prisma.agent.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}

export default new AgentService();