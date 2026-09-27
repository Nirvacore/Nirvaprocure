import type { BudgetRow, PeopleDepartment } from './api';

const demoDeptBudgets = [
  { spent: 280000_00, amount: 500000_00, soft: false },
  { spent: 650000_00, amount: 800000_00, soft: true },
  { spent: 1150000_00, amount: 1200000_00, soft: true },
  { spent: 120000_00, amount: 300000_00, soft: false },
];

export async function loadDemoBudgets(month: string): Promise<BudgetRow[]> {
  const { mockDepartments } = await import('./mock-data');
  const monthStart = `${month}-01`;
  return mockDepartments.map((department, index) => {
    const preset = demoDeptBudgets[index] ?? { spent: 0, amount: 100000_00, soft: false };
    const remaining = preset.amount - preset.spent;
    const pct = preset.amount > 0 ? Math.round((preset.spent / preset.amount) * 100) : 0;
    return {
      id: `bud-${department.cost_center}`,
      department_id: department.cost_center,
      department_name: department.name,
      month_start: monthStart,
      amount_minor: preset.amount,
      spent_minor: preset.spent,
      remaining_minor: remaining,
      pct_used: pct,
      soft_block: preset.soft,
    };
  });
}

export async function loadDemoDepartments(): Promise<PeopleDepartment[]> {
  const { mockDepartments } = await import('./mock-data');
  return mockDepartments.map((department) => ({
    id: department.cost_center,
    name: department.name,
    cost_center: department.cost_center,
    members: department.members,
  }));
}
