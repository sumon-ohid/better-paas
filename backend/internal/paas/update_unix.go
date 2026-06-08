//go:build unix

package paas

import "syscall"

// detachSysProcAttr puts the updater in its own session so it isn't terminated
// when systemd stops this server's unit (or the dev process tree exits).
func detachSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{Setsid: true}
}
