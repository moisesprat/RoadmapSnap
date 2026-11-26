import { useMemo, useState } from 'react'
import { apiToRoadmap, formatDDMMYYYY, normalizeTheme } from '@roadmapsnap/core'
import type { ThemeName } from '@roadmapsnap/core'
import { LiteRoadmapView } from '../components/lite/LiteRoadmapView'
import { useWorkspaceProjects, useWorkspaces } from '../hooks/useWorkspace'

// The SaaS page: workspaces and projects load through TanStack Query, core apiToRoadmap turns the raw ISO payload into
// the Lite config (D-15), and LiteRoadmapView renders Lite's page for it (D-02).
export default function DashboardPage() {
  const { data: workspacesData, isLoading: workspacesLoading, error: workspacesError } = useWorkspaces()
  const workspaces = workspacesData?.workspaces ?? []
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const workspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null
  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useWorkspaceProjects(workspaceId)

  const [theme, setTheme] = useState<ThemeName>(() => normalizeTheme(document.documentElement.getAttribute('data-theme')))
  function changeTheme(next: ThemeName) {
    document.documentElement.setAttribute('data-theme', next)
    setTheme(next)
  }

  const today = formatDDMMYYYY(new Date())
  const config = useMemo(() => (projectsData ? apiToRoadmap(projectsData, { today }) : null), [projectsData, today])

  const error = workspacesError ?? projectsError
  if (error) return <p role="alert">{error.message}</p>
  if (workspacesLoading || (workspaceId && projectsLoading) || !config || !workspaceId) return null

  return (
    <>
      {workspaces.length > 1 && (
        // Interim switcher until the SaaS header (02-15) owns workspace selection.
        <select aria-label="Workspace" value={workspaceId} onChange={(e) => setSelectedWorkspaceId(e.target.value)}>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}
      <LiteRoadmapView
        config={config}
        today={today}
        theme={theme}
        onThemeChange={changeTheme}
        onExportError={(err) => console.error(err)}
        resetKey={workspaceId}
      />
    </>
  )
}
