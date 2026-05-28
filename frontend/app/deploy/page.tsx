"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />

export default function DeployPage() {
  const router = useRouter()
  
  // State variables for Wizard
  const [step, setStep] = useState(1)
  const [deployName, setDeployName] = useState("")
  const [deployGit, setDeployGit] = useState("")
  const [deployGitToken, setDeployGitToken] = useState("")
  const [deployBranch, setDeployBranch] = useState("main")
  const [deployRootDir, setDeployRootDir] = useState("")
  const [deployEnvVars, setDeployEnvVars] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }])
  const [deployBuildCommand, setDeployBuildCommand] = useState("")
  const [deployStartCommand, setDeployStartCommand] = useState("")
  const [deployInstallCommand, setDeployInstallCommand] = useState("")
  const [deployPortOverride, setDeployPortOverride] = useState("")
  
  const [branchesList, setBranchesList] = useState<string[]>([])
  const [isFetchingBranches, setIsFetchingBranches] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const fetchBranches = async () => {
    if (!deployGit) return
    setIsFetchingBranches(true)
    setErrorMsg("")
    try {
      const res = await fetch("http://localhost:8080/api/git/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gitRepo: deployGit, gitToken: deployGitToken })
      })
      if (res.ok) {
        const list = await res.json()
        setBranchesList(list)
        if (list.length > 0) {
          if (list.includes("main")) {
            setDeployBranch("main")
          } else if (list.includes("master")) {
            setDeployBranch("master")
          } else {
            setDeployBranch(list[0])
          }
        }
      } else {
        const text = await res.text()
        setErrorMsg(`Failed to fetch branches: ${text}`)
        setBranchesList([])
      }
    } catch (err) {
      console.error(err)
      setErrorMsg("Network connection failed while fetching branches.")
      setBranchesList([])
    } finally {
      setIsFetchingBranches(false)
    }
  }

  const handleNext = () => {
    if (step === 1 && (!deployName || !deployGit)) {
      setErrorMsg("App name and Git repository URL are required.")
      return
    }
    setErrorMsg("")
    setStep((prev) => Math.min(prev + 1, 3))
  }

  const handleBack = () => {
    setErrorMsg("")
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleDeploy = async () => {
    if (!deployName || !deployGit) {
      setErrorMsg("Validation failed. Please verify Step 1 fields.")
      setStep(1)
      return
    }

    const envVarsRecord: Record<string, string> = {}
    deployEnvVars.forEach((item) => {
      if (item.key.trim() && item.value.trim()) {
        envVarsRecord[item.key.trim()] = item.value.trim()
      }
    })

    try {
      setIsDeploying(true)
      const res = await fetch("http://localhost:8080/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deployName,
          gitRepo: deployGit,
          branch: deployBranch,
          gitToken: deployGitToken,
          rootDir: deployRootDir,
          envVars: envVarsRecord,
          buildCommand: deployBuildCommand,
          startCommand: deployStartCommand,
          installCommand: deployInstallCommand,
          portOverride: deployPortOverride ? parseInt(deployPortOverride, 10) : 0,
        }),
      })

      if (res.ok) {
        const newApp = await res.json()
        // Go straight to the full-screen build log for this deployment
        router.push(`/logs?appId=${newApp.id}&mode=build`)
      } else {
        const text = await res.text()
        setErrorMsg(`Deployment submission failed: ${text}`)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg("Go backend connection failed. Deploy simulation is not supported on this route.")
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 px-2">
          {[
            { num: 1, label: "Git Integration" },
            { num: 2, label: "Build Context" },
            { num: 3, label: "Environment" }
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-3">
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                step === s.num
                  ? "bg-primary border-primary text-primary-foreground font-extrabold"
                  : step > s.num
                    ? "bg-muted border-muted text-primary"
                    : "border-border text-muted-foreground"
              }`}>
                {s.num}
              </span>
              <span className={`text-sm font-semibold hidden md:inline transition-colors ${
                step === s.num ? "text-foreground" : "text-muted-foreground"
              }`}>
                {s.label}
              </span>
              {s.num < 3 && <div className="h-px w-8 md:w-16 bg-border/40 mx-1" />}
            </div>
          ))}
        </div>

        <Card className="border border-border/80 bg-card/65 backdrop-blur-xl shadow-2xl">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base font-bold text-foreground">Deploy New Service</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Follow the wizard to build and host your software application.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 min-h-[300px]">
            {errorMsg && (
              <div className="mb-4 p-3 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs leading-relaxed">
                {errorMsg}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">App Name</Label>
                  <Input
                    id="name"
                    value={deployName}
                    onChange={(e) => setDeployName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="e.g. user-management-api"
                    className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary"
                    required
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="git" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Git Repository URL</Label>
                  <Input
                    id="git"
                    value={deployGit}
                    onChange={(e) => setDeployGit(e.target.value)}
                    placeholder="github.com/org/repo"
                    className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="gitToken" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Git Personal Access Token (PAT)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="gitToken"
                      type="password"
                      value={deployGitToken}
                      onChange={(e) => setDeployGitToken(e.target.value)}
                      placeholder="Optional PAT for private repositories"
                      className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary flex-1"
                    />
                    <Button
                      type="button"
                      onClick={fetchBranches}
                      disabled={isFetchingBranches || !deployGit}
                      className="h-9 cursor-pointer rounded-md bg-secondary text-secondary-foreground text-sm px-3 hover:bg-secondary/85 font-semibold"
                    >
                      {isFetchingBranches ? "Fetching..." : "Fetch Branches"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <Label htmlFor="branch" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Branch</Label>
                  {branchesList.length > 0 ? (
                    <Select value={deployBranch} onValueChange={(val) => setDeployBranch(val ?? "")}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Select a branch..." />
                      </SelectTrigger>
                      <SelectContent>
                        {branchesList.map((branch) => (
                          <SelectItem key={branch} value={branch}>
                            {branch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="branch"
                      value={deployBranch}
                      onChange={(e) => setDeployBranch(e.target.value)}
                      placeholder="main"
                      className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  )}
                  <span className="text-[11px] text-muted-foreground font-mono block mt-1">
                    * Fetch branches above, or type manually.
                  </span>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="rootDir" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Root Directory</Label>
                    <Input
                      id="rootDir"
                      value={deployRootDir}
                      onChange={(e) => setDeployRootDir(e.target.value)}
                      placeholder="./"
                      className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="portOverride" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Container Port Override</Label>
                    <Input
                      id="portOverride"
                      value={deployPortOverride}
                      onChange={(e) => setDeployPortOverride(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 3000"
                      className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="installCmd" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Install Command</Label>
                  <Input
                    id="installCmd"
                    value={deployInstallCommand}
                    onChange={(e) => setDeployInstallCommand(e.target.value)}
                    placeholder="Optional: custom package installation override"
                    className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="buildCmd" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Build Command Override</Label>
                    <Input
                      id="buildCmd"
                      value={deployBuildCommand}
                      onChange={(e) => setDeployBuildCommand(e.target.value)}
                      placeholder="e.g. npm run build"
                      className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="startCmd" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Command Override</Label>
                    <Input
                      id="startCmd"
                      value={deployStartCommand}
                      onChange={(e) => setDeployStartCommand(e.target.value)}
                      placeholder="e.g. node dist/main.js"
                      className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Environment Variables</Label>
                  <Button
                    type="button"
                    onClick={() => setDeployEnvVars((prev) => [...prev, { key: "", value: "" }])}
                    className="h-6 cursor-pointer rounded bg-secondary text-secondary-foreground text-xs px-2 hover:bg-secondary/85 flex items-center gap-1 font-semibold border-0"
                  >
                    <PlusIcon className="h-3 w-3" /> Add Var
                  </Button>
                </div>
                
                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                  {deployEnvVars.map((env, index) => (
                    <div key={index} className="flex gap-2 items-center animate-in fade-in-50 duration-150">
                      <Input
                        value={env.key}
                        onChange={(e) => {
                          const updated = [...deployEnvVars]
                          updated[index].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
                          setDeployEnvVars(updated)
                        }}
                        placeholder="VARIABLE_NAME"
                        className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-1 focus-visible:ring-primary flex-1 font-mono"
                      />
                      <Input
                        value={env.value}
                        onChange={(e) => {
                          const updated = [...deployEnvVars]
                          updated[index].value = e.target.value
                          setDeployEnvVars(updated)
                        }}
                        placeholder="value"
                        className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-1 focus-visible:ring-primary flex-1 font-mono"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          setDeployEnvVars((prev) => prev.filter((_, i) => i !== index))
                        }}
                        variant="ghost"
                        className="h-8 w-8 hover:bg-rose-500/15 text-rose-400 hover:text-rose-500 p-0 shrink-0 border-0"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {deployEnvVars.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground/60 border border-dashed border-border/80 rounded-md">
                      No environment variables configured.
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>

          {/* Wizard Footer Navigation */}
          <div className="p-4 border-t border-border/40 flex items-center justify-between bg-muted/5">
            <Button
              type="button"
              onClick={() => {
                if (step === 1) {
                  router.push("/")
                } else {
                  handleBack()
                }
              }}
              variant="outline"
              className="h-9 cursor-pointer rounded-md border-border bg-background px-3.5 text-sm text-foreground hover:bg-muted/30"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5 mr-1" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            <div className="flex gap-2">
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="h-9 cursor-pointer rounded-md bg-primary text-primary-foreground px-4 text-sm font-semibold hover:bg-primary/90"
                >
                  Next
                  <ChevronRightIcon className="h-3.5 w-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="h-9 cursor-pointer rounded-md bg-primary text-primary-foreground px-5 text-sm font-semibold hover:bg-primary/90 flex items-center gap-1.5"
                >
                  {isDeploying ? (
                    "Deploying..."
                  ) : (
                    <>
                      <PlayIcon className="h-3.5 w-3.5" />
                      Start Deploy
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
