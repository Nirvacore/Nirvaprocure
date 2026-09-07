import type { PeopleDepartment, PeopleUser, WorkflowWire } from './api';
import type { Workflow } from './mock-data';

/** Development-only settings fixtures, loaded only after explicit demo opt-in. */
export async function loadDemoWorkflows(): Promise<Array<Workflow & { _wire: WorkflowWire }>> {
  const { mockWorkflows } = await import('./mock-data');
  return mockWorkflows.map((workflow) => ({
    ...workflow,
    _wire: undefined as unknown as WorkflowWire,
  }));
}

export async function loadDemoUsers(): Promise<PeopleUser[]> {
  const { mockUsers } = await import('./mock-data');
  return mockUsers.map((user) => ({
    id: user.email,
    email: user.email,
    full_name: user.name,
    is_active: user.active,
    department: user.dept,
    role: user.role,
  }));
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
