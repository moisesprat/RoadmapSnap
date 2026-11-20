/**
 * Typed API client for RoadmapSnap backend.
 */

export interface WorkspaceSummary {
  id: string
  name: string
  slug: string
}

export interface MilestoneMap {
  [key: string]: string
}

/** Milestones as the API sends them: ISO YYYY-MM-DD strings, or null when no date is planned. */
export interface ApiMilestoneMap {
  [key: string]: string | null
}

/**
 * Converts an API ISO date (YYYY-MM-DD) to Lite's DD/MM/YYYY using string operations only, so no
 * timezone can shift it. null, undefined and '' become ''. Any other string is returned unchanged
 * so an unexpected value stays visible in the UI instead of disappearing.
 */
export function isoToLiteDate(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [yyyy, mm, dd] = value.split('-')
  return `${dd}/${mm}/${yyyy}`
}

/** Dependency from API (task name; optional from/to milestone keys later) */
export interface ProjectDependency {
  task: string
  from?: string
  to?: string
}

export interface Project {
  id: string
  name: string
  group_name: string | null
  at_risk: boolean
  descoped: boolean
  show_in_timeline: boolean
  tags: string[]
  external_link: string | null
  display_order: number
  milestones: MilestoneMap
  /** Inbound/outbound dependency task names (from API); empty if none */
  dependencies?: ProjectDependency[]
}

export interface WorkflowItem {
  type: 'state' | 'milestone'
  key: string
  short: string
  title: string
  description?: string
  subtitle?: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  workflow_definition: WorkflowItem[]
  entity_labels: Record<string, string>
  dashboard_text: Record<string, string>
  settings: Record<string, unknown>
}

export interface WorkspaceWithProjects {
  workspace: Workspace
  projects: Project[]
}

type ApiProject = Omit<Project, 'milestones'> & { milestones: ApiMilestoneMap }

interface ApiWorkspaceWithProjects {
  workspace: Workspace
  projects: ApiProject[]
}

export interface UserPreferences {
  theme: 'light' | 'dark'
}

export interface OrgMembership {
  id: string
  name: string
  role: 'viewer' | 'editor' | 'admin'
}

/** Shape of GET /auth/me. role is null when the user belongs to no organization. */
export interface CurrentUser {
  sub: string
  email: string
  name: string
  preferences: UserPreferences
  role: 'viewer' | 'editor' | 'admin' | null
  orgId: string | null
  orgs: OrgMembership[]
}

export interface CreateProjectBody {
  name: string
  group_name?: string | null
  at_risk?: boolean
  descoped?: boolean
  show_in_timeline?: boolean
  tags?: string[]
  external_link?: string | null
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

export class ApiClient {
  constructor(
    private baseUrl: string = '',
    private getAccessToken: () => Promise<string>
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.getAccessToken()
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new ApiError(401, 'No access token available. Please sign in again.')
    }
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new ApiError(401, 'Invalid access token format. Please sign in again.')
    }
    const url = this.baseUrl + path
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      let message = res.statusText
      try {
        const data = await res.json() as { message?: string; error?: string }
        message = data.message ?? data.error ?? message
      } catch {
        // ignore
      }
      throw new ApiError(res.status, message)
    }
    return res.json() as Promise<T>
  }

  getWorkspaces(): Promise<{ workspaces: WorkspaceSummary[] }> {
    return this.request('GET', '/api/v1/workspaces')
  }

  getWorkspace(id: string): Promise<{ workspace: Workspace }> {
    return this.request('GET', `/api/v1/workspaces/${id}`)
  }

  // Edge adapter: the API speaks ISO dates, the current timeline parses Lite DD/MM/YYYY.
  // Phase 2's shared-core edge adapter replaces this conversion.
  async getWorkspaceProjects(id: string): Promise<WorkspaceWithProjects> {
    const raw = await this.request<ApiWorkspaceWithProjects>(
      'GET',
      `/api/v1/workspaces/${id}/projects`
    )
    return {
      workspace: raw.workspace,
      projects: raw.projects.map((project) => ({
        ...project,
        milestones: Object.fromEntries(
          Object.entries(project.milestones ?? {}).map(([key, date]) => [key, isoToLiteDate(date)])
        ),
      })),
    }
  }

  createWorkspace(body: { name: string; slug: string }): Promise<{ workspace: Workspace }> {
    return this.request('POST', '/api/v1/workspaces', body)
  }

  updateWorkspace(id: string, body: Partial<Workspace>): Promise<{ workspace: Workspace }> {
    return this.request('PATCH', `/api/v1/workspaces/${id}`, body)
  }

  getMe(): Promise<CurrentUser> {
    return this.request('GET', '/auth/me')
  }

  updateMe(body: { preferences: UserPreferences }): Promise<CurrentUser> {
    return this.request('PATCH', '/auth/me', body)
  }

  createProject(workspaceId: string, body: CreateProjectBody): Promise<{ project: Project }> {
    return this.request('POST', `/api/v1/workspaces/${workspaceId}/projects`, body)
  }

  updateProject(projectId: string, body: Partial<CreateProjectBody>): Promise<{ project: Project }> {
    return this.request('PATCH', `/api/v1/projects/${projectId}`, body)
  }

  deleteProject(projectId: string): Promise<void> {
    return this.request('DELETE', `/api/v1/projects/${projectId}`)
  }
}

export function createApiClient(
  getAccessToken: () => Promise<string>,
  baseUrl: string = ''
): ApiClient {
  return new ApiClient(baseUrl, getAccessToken)
}
