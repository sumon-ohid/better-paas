"use client"

import React, { useState, useEffect, useCallback, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { BreadcrumbPage } from "@/components/ui/breadcrumb"
import { AppShell, useToast } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import {
  BreadcrumbHeaderRow,
  BreadcrumbRenameIconButton,
  BreadcrumbRenameInput,
  ProjectBreadcrumb,
} from "@/components/project-breadcrumb"
import { ProjectServicesOverview } from "@/components/project-services-overview"
import { ProjectDeployConfigPanel } from "@/components/project-deploy-config"
import { NucleoIcon } from "@/components/nucleo-icons"
import { api } from "@/lib/api"
import type { ProjectDetail, ProjectSummary } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const EditIcon = (props: IconProps) => <NucleoIcon {...props} name="edit" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const SettingsIcon = (props: IconProps) => <NucleoIcon {...props} name="settings" />
const GridIcon = (props: IconProps) => <NucleoIcon {...props} name="grid" />

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const { showToast } = useToast()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [view, setView] = useState<"services" | "config">(() =>
    searchParams.get("tab") === "config" ? "config" : "services",
  )

  const fetchProject = useCallback(async () => {
    try {
      const data = await api.projects.get(projectId)
      setProject(data)
    } catch (err) {
      console.error(err)
      showToast("Error", "Project not found.", "destructive")
      router.push("/")
    } finally {
      setLoading(false)
    }
  }, [projectId, router, showToast])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const data = await api.projects.get(projectId)
        if (!cancelled) setProject(data)
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          showToast("Error", "Project not found.", "destructive")
          router.push("/")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, router, showToast])

  useEffect(() => {
    api.projects
      .list()
      .then(setAllProjects)
      .catch((err) => console.error("Failed to load projects", err))
  }, [])

  useEffect(() => {
    const building = project?.services.some((s) => s.status === "building")
    if (!building) return
    const interval = setInterval(fetchProject, 2500)
    return () => clearInterval(interval)
  }, [project, fetchProject])

  const cancelRename = () => {
    setIsEditingName(false)
    setRenameValue(project?.name ?? "")
  }

  const handleRename = async () => {
    const name = renameValue.trim()
    if (!name || !project) return
    if (name === project.name) {
      cancelRename()
      return
    }
    setIsRenaming(true)
    try {
      const updated = await api.projects.rename(project.id, name)
      setProject((prev) =>
        prev ? { ...prev, name: updated.name } : prev,
      )
      setIsEditingName(false)
      showToast("Renamed", `Project is now "${updated.name}".`, "success")
    } catch {
      showToast("Error", "Failed to rename project.", "destructive")
    } finally {
      setIsRenaming(false)
    }
  }

  const handleDelete = async () => {
    try {
      await api.projects.delete(projectId)
      showToast("Deleted", "Project and all services removed.", "success")
      router.push("/")
    } catch {
      showToast("Error", "Failed to delete project.", "destructive")
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading project…
        </div>
      </AppShell>
    )
  }

  if (!project) return null

  const addService = () => router.push(`/deploy?projectId=${project.id}`)
  const hasStackConfig = Boolean(project.deployType && project.primaryServiceId)

  return (
    <AppShell appCount={project.serviceCount}>
      <div className="space-y-3 m-4 md:mx-6">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3">
          <BreadcrumbHeaderRow
            trailing={
              <>
                <StatusBadge status={project.status} />
                {!isEditingName ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setRenameValue(project.name)
                      setIsEditingName(true)
                    }}
                    aria-label="Rename project"
                  >
                    <EditIcon className="h-4 w-4" />
                  </Button>
                ) : null}
              </>
            }
          >
            <ProjectBreadcrumb
              projects={allProjects}
              currentProjectId={projectId}
              projectCrumb={
                isEditingName ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <BreadcrumbRenameInput
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      disabled={isRenaming}
                      aria-label="Project name"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRename()
                        if (e.key === "Escape") cancelRename()
                      }}
                    />
                    <BreadcrumbRenameIconButton
                      onClick={() => void handleRename()}
                      disabled={isRenaming}
                      label="Save name"
                      variant="success"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </BreadcrumbRenameIconButton>
                    <BreadcrumbRenameIconButton
                      onClick={cancelRename}
                      disabled={isRenaming}
                      label="Cancel rename"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </BreadcrumbRenameIconButton>
                  </div>
                ) : (
                  <BreadcrumbPage>{project.name}</BreadcrumbPage>
                )
              }
            />
          </BreadcrumbHeaderRow>
          {hasStackConfig ? (
            view === "services" ? (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-8 shrink-0 gap-1.5 text-xs"
                onClick={() => setView("config")}
              >
                <SettingsIcon className="h-3.5 w-3.5" />
                Config
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-8 shrink-0 gap-1.5 text-xs"
                onClick={() => setView("services")}
              >
                <GridIcon className="h-3.5 w-3.5" />
                Services
              </Button>
            )
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground sm:text-sm">
          {project.serviceCount}{" "}
          {project.serviceCount === 1 ? "service" : "services"} · Created{" "}
          {formatRelativeTime(project.createdAt)}
          {hasStackConfig ? (
            <>
              {" "}
              ·{" "}
              {project.deployType === "compose"
                ? "Docker Compose stack"
                : "Dockerfile project"}
            </>
          ) : null}
        </p>
      </div>

      <div className="p-4 md:p-6">
        {view === "config" && hasStackConfig ? (
          <ProjectDeployConfigPanel
            projectId={project.id}
            deployType={project.deployType!}
            primaryServiceId={project.primaryServiceId!}
            serviceCount={project.serviceCount}
            onRefresh={fetchProject}
          />
        ) : (
          <ProjectServicesOverview
            services={project.services}
            loading={loading}
            onRefresh={fetchProject}
            onAddService={addService}
            onDeleteProject={() => setShowDeleteModal(true)}
          />
        )}
      </div>

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        appName={project.name}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </AppShell>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ProjectDetailPage />
    </Suspense>
  )
}
