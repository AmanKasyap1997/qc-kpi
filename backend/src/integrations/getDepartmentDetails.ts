import axios from "axios";
import db from "../db/pool"; // adjust path if needed

export async function syncCallerReadyDepartments() {
  try {
    // 1. Fetch data
    const response = await axios.get(
      `${process.env.CALLERREADY_BASE_URL}/api/ci/GetCustomerLocationList`,
      {
        headers: {
          apikey: process.env.CALLERREADY_API_KEY,
        },
      }
    );

    const data =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    if (!Array.isArray(data)) return;
    for (const item of data) {
      const code = item?.Value?.trim();
      const name = item?.DisplayText?.trim();

      if (!code || !name) continue;

      // 4. INSERT ONLY IF NOT EXISTS (NO UPDATE)
      await db.query(`INSERT INTO departments (code, name, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (code) DO UPDATE SET updated_at = NOW(); `, [code, name]);
    }

    console.log(`✅ Departments sync completed: ${data.length}`);
    return { success: true, message: "Departments synced successfully", };
  } catch (error: any) {
    console.error(
      "❌ Department Sync Error:",
      error.response?.data || error.message
    );
  }
}