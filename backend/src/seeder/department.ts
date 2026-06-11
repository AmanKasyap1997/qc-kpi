// prisma/seed/departments.seed.ts
import { prisma } from '../../lib/prisma.js'


const departments = [
  {
    name: "Debt Sales",
    code: "DEBT_SALES",
    zeroTolerance: false,
    maxStrikes: 2,
    pipDurationDays: 14,
    qaThresholdWarning: 45,
    qaThresholdPip: 35,
  },
  {
    name: "Verification",
    code: "VERIFICATION",
    zeroTolerance: true,
    maxStrikes: 2,
    pipDurationDays: 14,
    qaThresholdWarning: 45,
    qaThresholdPip: 35,
  },
  {
    name: "Customer Service",
    code: "CS",
    zeroTolerance: false,
    maxStrikes: 2,
    pipDurationDays: 14,
    qaThresholdWarning: 45,
    qaThresholdPip: 40,
  },
  {
    name: "Case Managers",
    code: "CM",
    zeroTolerance: false,
    maxStrikes: 2,
    pipDurationDays: 14,
    qaThresholdWarning: 50,
    qaThresholdPip: 40,
  },
  {
    name: "City Financial",
    code: "FINANCE",
    zeroTolerance: false,
    maxStrikes: 2,
    pipDurationDays: 14,
    qaThresholdWarning: 50,
    qaThresholdPip: 40,
  },
  {
    name: "SDR",
    code: "SDR",
    zeroTolerance: false,
    maxStrikes: 2,
    pipDurationDays: 14,
    qaThresholdWarning: 45,
    qaThresholdPip: 35,
  },
  {
    name: "Jr Closer",
    code: "JR_CLOSER",
    zeroTolerance: false,
    maxStrikes: 2,
    pipDurationDays: 14,
    qaThresholdWarning: 45,
    qaThresholdPip: 35,
  },
  {
    name: "Sr Closer",
    code: "SR_CLOSER",
    zeroTolerance: false,
    maxStrikes: 2,
    pipDurationDays: 14,
    qaThresholdWarning: 50,
    qaThresholdPip: 40,
  },
];

export async function run() {
for (const department of departments) {
  const existing = await prisma.department.findFirst({
    where: {
      code: department.code,
    },
  });

  if (existing) {
    await prisma.department.update({
      where: {
        id: existing.id,
      },
      data: department,
    });
  } else {
    await prisma.department.create({
      data: department,
    });
  }
}

  console.log(`✅ Seeded ${departments.length} departments`);
}