import "dotenv/config";

import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import * as PrismaTypes from "../generated/prisma";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });

export const Prisma = PrismaTypes.Prisma;