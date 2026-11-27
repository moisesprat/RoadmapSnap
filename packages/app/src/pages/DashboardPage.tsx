import { useMemo, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { apiToRoadmap, formatDDMMYYYY } from '@roadmapsnap/core'
import { ApiError } from '../api/client'
import { LiteRoadmapView } from '../components/lite/LiteRoadmapView'
import {
  LoadError,
  LoadingSkeleton,
  NoticeRegion,
  NoWorkspaces,
  SessionExpired,
  WorkflowNotConfigured,
} from '../components/layout/PageStates'
import type { Notice } from '../components/layout/PageStates'
import SaasHeader from '../components/layout/SaasHeader'
import { useRole } from '../hooks/useRole'
import { useTheme } from '../hooks/useTheme'
import { useWorkspaceProjects, useWorkspaces } from '../hooks/useWorkspace'

const PNG_EXPORT_FAILED = 'PNG export failed. Try again.'
const NO_PROJECTS_EDITOR = 'This workspace has no projects yet. Use Add project to create the first one.'
const NO_PROJECTS_VIEWER = 'This workspace has no projects yet.'

// The SaaS page: workspaces and projects load through TanStack Query, core apiToRoadmap turns the raw ISO payload into
// the Lite config (D-15), and LiteRoadmapView renders Lite's page for it (D-02). Loading, error and empty states and
// the notice region come from PageStates; the theme comes from useTheme.
export default function DashboardPage() {
  const { loginWithRedirect } = useAuth0()
  const { can } = useRole()
  const { theme, setTheme, notice: themeNotice, dismissNotice } = useTheme()
  const {
    data: workspacesData,
    isLoading: workspacesLoading,
    error: workspacesError,
    refetch: refetchWorkspaces,
  } = useWorkspaces()
  const workspaces = workspacesData?.workspaces ?? []
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const workspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null
  const {
    data: projectsData,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useWorkspaceProjects(workspaceId)
  const [exportFailed, setExportFailed] = useState(false)

  const today = formatDDMMYYYY(new Date())
  const config = useMemo(() => (projectsData ? apiToRoadmap(projectsData, { today }) : null), [projectsData, today])

  function selectWorkspace(id: string) {
    setSelectedWorkspaceId(id)
    setExportFailed(false)
  }

  const header = (
    <SaasHeader
      workspaces={workspaces}
      workspacesLoading={workspacesLoading}
      workspaceId={workspaceId}
      onWorkspaceChange={selectWorkspace}
      projects={projectsData?.projects ?? []}
    />
  )

  const error = workspacesError ?? projectsError
  if (error) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <>
          {header}
          <SessionExpired onSignIn={() => void loginWithRedirect()} />
        </>
      )
    }
    return (
      <>
        {header}
        <LoadError
          message={error.message}
          onRetry={() => {
            void refetchWorkspaces()
            if (workspaceId) void refetchProjects()
          }}
        />
      </>
    )
  }
  if (workspacesLoading || (workspaceId && projectsLoading)) {
    return (
      <>
        {header}
        <LoadingSkeleton />
      </>
    )
  }
  if (workspaces.length === 0) {
    return (
      <>
        {header}
        <NoWorkspaces />
      </>
    )
  }
  if (!projectsData || !config) {
    // A workspace whose projects cannot be requested (its id is not a UUID) never loads; say so instead of spinning.
    return (
      <>
        {header}
        <LoadError onRetry={() => void refetchWorkspaces()} />
      </>
    )
  }
  if ((projectsData.workspace?.workflow_definition?.length ?? 0) === 0) {
    return (
      <>
        {header}
        <WorkflowNotConfigured />
      </>
    )
  }

  const notices: Notice[] = []
  if (projectsData.projects.length === 0) {
    notices.push({ id: 'no-projects', text: can('editor') ? NO_PROJECTS_EDITOR : NO_PROJECTS_VIEWER })
  }
  if (exportFailed) notices.push({ id: 'png', text: PNG_EXPORT_FAILED, onDismiss: () => setExportFailed(false) })
  if (themeNotice) notices.push({ id: 'theme', text: themeNotice, onDismiss: dismissNotice })

  return (
    <>
      {header}
      <NoticeRegion notices={notices} />
      <LiteRoadmapView
        config={config}
        today={today}
        theme={theme}
        onThemeChange={setTheme}
        // LiteExportControls logs the error as Lite does; the page tells the user.
        onExportError={() => setExportFailed(true)}
        resetKey={workspaceId ?? ''}
      />
    </>
  )
}
